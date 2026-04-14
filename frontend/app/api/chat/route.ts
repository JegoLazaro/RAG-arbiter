import { NextRequest } from 'next/server';
import { Pinecone } from '@pinecone-database/pinecone';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function POST(req: NextRequest) {
  const { messages } = await req.json();
  const latestMessage = messages[messages.length - 1].content;

  // Create a stream to send data back to the frontend chunk-by-chunk
  const stream = new ReadableStream({
    async start(controller) {
      // push logs to the frontend
      const sendStatus = (message: string) => {
        const payload = JSON.stringify({ type: 'status', message });
        controller.enqueue(new TextEncoder().encode(payload + '\n'));
      };

      try {
        sendStatus("Initializing clients...");
        const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

        const embeddingModel = genAI.getGenerativeModel({ model: "gemini-embedding-001" });
        const chatModel = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

        sendStatus("Vectorizing user query to 3,072 dimensions...");
        const embedRes = await embeddingModel.embedContent(latestMessage);
        const vector = embedRes.embedding.values;

        sendStatus(`Querying Pinecone index for relevant lore...`);
        const index = pc.index({ name:process.env.PINECONE_INDEX_NAME! });
        const queryResponse = await index.query({
          vector: vector, 
          topK: 5, 
          includeMetadata: true,
        });

        sendStatus(`Retrieved ${queryResponse.matches.length} highly relevant lore chunks.`);
        
        const sources = queryResponse.matches.map((match) => {
          let parsedCitations = {};
          if (match.metadata?.citations) {
            try { parsedCitations = JSON.parse(match.metadata.citations as string); } 
            catch (e) {console.warn("Failed to parse citations for match:", e);}
          }
          return {
            name: match.metadata?.character || match.metadata?.source || "Unknown Source",
            text: match.metadata?.text as string,
            score: (match.score! * 100).toFixed(1),
            citations: parsedCitations
          };
        });

        const loreContext = sources.map((s, i) => {
          return `--- CHUNK ${i + 1} (Source: ${s.name}) ---\nTEXT: ${s.text}\nCITATIONS: ${JSON.stringify(s.citations)}`;
        }).join("\n\n");

        sendStatus("Synthesizing Arbiter verdict based on grounding data...");
        const prompt = `
          You are the Anime Arbiter, an expert judge of fictional battles. 
          STRICT RULES:
          1. Use ONLY the provided Lore Snippets.
          2. QUOTES: Provide direct quotes if possible.
          3. CITATIONS: Reference the Manga Chapter/Page if provided in the citations.

          LORE SNIPPETS:
          ${loreContext}
          
          USER QUESTION:
          ${latestMessage}
        `;

        const result = await chatModel.generateContent(prompt);
        
        // Send the final result object
        const finalPayload = JSON.stringify({ 
          type: 'result', 
          answer: result.response.text(), 
          sources: sources 
        });
        controller.enqueue(new TextEncoder().encode(finalPayload + '\n'));
        
        // Close the stream
        controller.close();

      } catch (error: any) {
        console.error("API Error:", error.status);
        
        // Safely parse the exact error from Gemini or Pinecone
        let userFriendlyError = "Connection to Arbiter failed.";
        
        if (error.status === 429) {
          userFriendlyError = "Rate Limit Exceeded. The Arbiter's cursed energy is depleted for today (Pinecone Quota Limit Exceeded).";
        } else if (error.status === 404) {
          userFriendlyError = "Model not found. Ensure you are using the correct Gemini 3 preview tags.";
        } else {
          // Fallback error
          userFriendlyError = error.message || "An unknown anomaly disrupted the connection.";
        }

        // Send the error message through the stream so the frontend terminal sees it
        sendStatus(`Error: ${userFriendlyError}`);
        controller.close();

        // console.error("API Error:", error);
        // sendStatus("Error: Connection to Arbiter failed.");
        // controller.close();
      }
    }
  });

  // Return the stream immediately, don't wait for the logic to finish
  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson',
      'Cache-Control': 'no-cache',
    },
  });
}