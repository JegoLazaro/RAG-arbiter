import { NextRequest } from "next/server";
import { Pinecone } from "@pinecone-database/pinecone";
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function POST(req: NextRequest) {
  const { messages } = await req.json();

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: "Invalid message payload." }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const latestMessage = messages[messages.length - 1].content;
    
    if (!latestMessage || typeof latestMessage !== 'string') {
        return new Response(JSON.stringify({ error: "Message content is missing." }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

  // Create a stream to send data back to the frontend chunk-by-chunk
  const stream = new ReadableStream({
    async start(controller) {
      // push logs to the frontend
      const sendStatus = (message: string) => {
        const payload = JSON.stringify({ type: "status", message });
        controller.enqueue(new TextEncoder().encode(payload + "\n"));
      };

      try {
        sendStatus("Initializing Arbiter Protocol...");
        const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

        const embeddingModel = genAI.getGenerativeModel({
          model: "gemini-embedding-001",
        });
        
        
        const chatModel = genAI.getGenerativeModel({
          model: "gemini-3-flash-preview",
        });

        sendStatus("Vectorizing query to 3,072 dimensions...");
        const embedRes = await embeddingModel.embedContent(latestMessage);
        const vector = embedRes.embedding.values;

        sendStatus(`Querying Pinecone index for relevant lore...`);
        const index = pc.index({ name: process.env.PINECONE_INDEX_NAME! });
        const queryResponse = await index.query({
          vector: vector,
          topK: 10, 
          includeMetadata: true,
        });

        sendStatus(
          `Retrieved ${queryResponse.matches.length} historical and lore fragments.`
        );

        const sources = queryResponse.matches.map((match) => {
          let parsedCitations = {};
          if (match.metadata?.citations) {
            try {
              parsedCitations = typeof match.metadata.citations === 'string' 
                ? JSON.parse(match.metadata.citations) 
                : match.metadata.citations;
            } catch (e) {
              console.warn("Failed to parse citations for match:", e);
            }
          }

          // Dynamically identify if this is a Chapter Summary or a Character Profile
          const isChapter = !!match.metadata?.chapter_number;
          const sourceName = isChapter 
            ? `Chapter ${match.metadata?.chapter_number}: ${match.metadata?.name}`
            : (match.metadata?.character as string || "General Lore");

          return {
            name: sourceName,
            text: match.metadata?.text as string,
            score: (match.score! * 100).toFixed(1),
            citations: parsedCitations,
            type: isChapter ? "chronicle" : "lore"
          };
        });

        const loreContext = sources
          .map((s, i) => {
            return `--- CHUNK ${i + 1} (Source: ${s.name}) ---\nTEXT: ${s.text}\nCITATIONS: ${JSON.stringify(s.citations)}`;
          })
          .join("\n\n");

        sendStatus("Synthesizing Arbiter verdict based on grounding data...");
        const prompt = `
          You are the Anime Arbiter, the supreme historian of the Jujutsu Kaisen universe.
          
          You have access to two types of data:
          1. LORE: Core character profiles and abilities.
          2. CHRONICLES: Plot summaries of specific chapters.

          FORMATTING RULES:
          1. Use clear Markdown headers (### section) for different parts of the analysis.
          2. Use bullet points for specific feats or facts.
          3. Use double line breaks between paragraphs.
          4. BOLD key terms, techniques, or character names.

          STRICT INSTRUCTIONS:
          - If a CHRONICLE describes an event that contradicts a general LORE snippet, prioritize the CHRONICLE (it represents the actual timeline).
          - Always cite the chapter number clearly if the information comes from a Chronicle.
          - If the user asks about a character not in the snippets, explicitly state that your "sacred texts" do not contain them.

          GROUNDING DATA:
          ${loreContext}
          
          USER QUESTION:
          ${latestMessage}
        `;

        const result = await chatModel.generateContent(prompt);

        const finalPayload = JSON.stringify({
          type: "result",
          answer: result.response.text(),
          sources: sources,
        });
        controller.enqueue(new TextEncoder().encode(finalPayload + "\n"));

        // Close the stream
        controller.close();
      } catch (error: any) {
        console.error("API Error:", error?.status);
        let userFriendlyError = error.message || "An anomaly disrupted the connection.";
        
        if (error.status === 429) {
          userFriendlyError =
            "Rate Limit Exceeded. The Arbiter's cursed energy is depleted for today (Pinecone Quota Limit Exceeded).";
        } else if (error.status === 404) {
          userFriendlyError =
            "Model not found. Ensure you are using the correct Gemini 3 preview tags.";
        } else {
          // Fallback error
          userFriendlyError =
            error.message || "An unknown anomaly disrupted the connection.";
        }

        // Send the error message through the stream so the frontend terminal sees it
        sendStatus(`Error: ${userFriendlyError}`);
        controller.close();
      }
    },
  });

  // Return the stream immediately, don't wait for the logic to finish
  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-cache",
    },
  });
}
