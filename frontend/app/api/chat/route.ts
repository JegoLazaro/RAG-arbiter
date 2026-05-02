import { NextRequest } from "next/server";
import { Pinecone } from "@pinecone-database/pinecone";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const ratelimit = new Ratelimit({
  redis: new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!
  }),
  limiter: Ratelimit.slidingWindow(10, "1 m"),
  analytics: true,
});

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") ?? "127.0.0.1";
  const { success } = await ratelimit.limit(ip);

  if (!success) {
    // If req failed, immediately return a 429 and kill the request
    return new Response(
      JSON.stringify({
        error:
          "Rate Limit Exceeded. The Arbiter's cursed energy is depleted for you. Please wait 60 seconds.",
      }),
      {
        status: 429,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
  const { messages } = await req.json();

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return new Response(JSON.stringify({ error: "Invalid message payload." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const latestMessage = messages[messages.length - 1].content;

  if (!latestMessage || typeof latestMessage !== "string") {
    return new Response(
      JSON.stringify({ error: "Message content is missing." }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      },
    );
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

        const routerModel = genAI.getGenerativeModel({
          model: "gemini-3-flash-preview",
          generationConfig: { responseMimeType: "application/json" },
        });

        sendStatus("Analyzing query intent...");
        const routerPrompt = `
            Analyze the following user message. 
            1. Does it require looking up specific facts, lore, or plot details from an anime?
            2. Which specific anime universes are mentioned or implied? 
            
            Available namespaces: 
            - "" (Use this empty string for Jujutsu Kaisen)
            - "my-hero-academia" (Use this for My Hero Academia)
            - "demon-slayer" (Use this for Demon Slayer / Kimetsu no Yaiba)

            Message: "${latestMessage}"
            
            Return ONLY a raw JSON object with a boolean "requires_lore" and an array of strings "namespaces".
            Example 1 (JJK only): {"requires_lore": true, "namespaces": [""]}
            Example 2 (MHA only): {"requires_lore": true, "namespaces": ["my-hero-academia"]}
            Example 3 (DS only): {"requires_lore": true, "namespaces": ["demon-slayer"]}
            Example 4.a (Crossover): {"requires_lore": true, "namespaces": ["", "my-hero-academia"]}
            Example 4.b (Crossover): {"requires_lore": true, "namespaces": ["", "demon-slayer"]}
            Example 4.c (Crossover): {"requires_lore": true, "namespaces": ["my-hero-academia", "demon-slayer"]}
            Example 5 (Math/Off-topic): {"requires_lore": false, "namespaces": []}
          `;

        const routerResult = await routerModel.generateContent(routerPrompt);
        const { requires_lore, namespaces } = JSON.parse(
          routerResult.response.text(),
        );

        let finalPrompt = "";
        let finalSources: any[] = [];
        if (requires_lore) {
          sendStatus("Vectorizing query to 3,072 dimensions...");
          const embedRes = await embeddingModel.embedContent(latestMessage);
          const vector = embedRes.embedding.values;

          sendStatus(`Querying Pinecone index for relevant lore...`);
          const index = pc.index({ name: process.env.PINECONE_INDEX_NAME! });
          const queryPromises = namespaces.map((ns: string) =>
            index
              .namespace(ns)
              .query({
                vector: vector,
                topK: 10,
                includeMetadata: true,
              })
              .then((res) => {
                return { ...res, requestedNamespace: ns };
              }),
          );

          // Wait for all database queries to finish simultaneously
          const queryResponses = await Promise.all(queryPromises);

          // Combine all matches from all universes into one massive array
          let allMatches: any[] = [];
          // Filter matches below similarity score 0.60
          const SCORE_THRESHOLD = 0.6;
          // get 5 from universe 1 and 5 from universe 2
          const limitPerUniverse = Math.floor(10 / namespaces.length);
          queryResponses.forEach((res) => {
            const validNamespaceMatches = (res.matches || [])
              .filter(
                (m: any) => m.score !== undefined && m.score > SCORE_THRESHOLD,
              )
              .map((m: any) => ({
                ...m,
                // Inject the universe label directly into the match object
                injected_universe:
                  res.requestedNamespace === "my-hero-academia"
                    ? "My Hero Academia"
                    : res.requestedNamespace === "demon-slayer"
                      ? "Demon Slayer"
                      : "Jujutsu Kaisen",
              }));

            // Sort matches for THIS specific universe, and take the top chunks
            const topForThisUniverse = validNamespaceMatches
              .sort((a: any, b: any) => b.score! - a.score!)
              .slice(0, limitPerUniverse);

            allMatches = [...allMatches, ...topForThisUniverse];
          });

          const validMatches = allMatches;

          sendStatus(
            `Retrieved ${validMatches.length} highly relevant cross-universe fragments.`,
          );

          finalSources = validMatches.map((match) => {
            let parsedCitations = {};
            if (match.metadata?.citations) {
              try {
                parsedCitations =
                  typeof match.metadata.citations === "string"
                    ? JSON.parse(match.metadata.citations)
                    : match.metadata.citations;
              } catch (e) {
                console.warn("Failed to parse citations for match:", e);
              }
            }

            const isChapter = !!match.metadata?.chapter_number;
            const sourceName = isChapter
              ? `Chapter ${match.metadata?.chapter_number}: ${match.metadata?.name}`
              : (match.metadata?.character as string) || "General Lore";

            return {
              name: sourceName,
              text: match.metadata?.text as string,
              score: (match.score! * 100).toFixed(1),
              citations: parsedCitations,
              type: isChapter ? "chronicle" : "lore",
              universe: match.injected_universe,
            };
          });

          const loreContext = finalSources
            .map((s, i) => {
              return `--- CHUNK ${i + 1} (Source: ${s.name} | Universe: ${s.universe}) ---\nTEXT: ${s.text}\nCITATIONS: ${JSON.stringify(s.citations)}`;
            })
            .join("\n\n");

          sendStatus("Synthesizing Arbiter verdict based on grounding data...");

          finalPrompt = `
          You are the Anime Arbiter, the supreme historian of the Anime Multiverse.
          
          You have access to two types of data:
          1. LORE: Core character profiles and abilities.
          2. CHRONICLES: Plot summaries of specific chapters.

          FORMATTING RULES:
          1. Use clear Markdown headers (### section) for different parts of the analysis.
          2. Use bullet points for specific feats or facts.
          3. Use double line breaks between paragraphs.
          4. BOLD key terms, techniques, or character names.
          5. Use blockquotes for direct citations from the sources, and always include the source name and universe in the citation.
          6. Use tables if comparing multiple characters or universes side by side.

          STRICT INSTRUCTIONS:
          - If a CHRONICLE describes an event that contradicts a general LORE snippet, prioritize the CHRONICLE (it represents the actual timeline).
          - Always cite the chapter number clearly if the information comes from a Chronicle.
          - If the user asks about a character not in the snippets, explicitly state that your "sacred texts" do not contain them.
          - If evaluating a cross-universe battle, objectively compare their feats based ONLY on the provided grounding data.

          GROUNDING DATA:
          ${loreContext}
          
          USER QUESTION:
          ${latestMessage}
        `;
        } else {
          sendStatus("General inquiry detected. Bypassing databanks...");
          finalPrompt = `
              You are the Anime Arbiter. The user just asked a general, conversational, or off-topic question that does NOT require anime lore.
              Answer their question naturally, but strictly maintain your persona as an all-knowing historian of cursed energy and quirks.
              Keep your answer brief, solve their problem, and invite them to ask a lore-specific question when you are done.

              USER QUESTION:
              ${latestMessage}
            `;
        }

        const result = await chatModel.generateContent(finalPrompt);

        const finalPayload = JSON.stringify({
          type: "result",
          answer: result.response.text(),
          sources: finalSources,
        });
        controller.enqueue(new TextEncoder().encode(finalPayload + "\n"));

        // Close the stream
        controller.close();
      } catch (error: any) {
        console.error("API Error:", error);

        let userFriendlyError = "An anomaly disrupted the connection.";

        // Check if the error message specifically mentions Pinecone
        const isPineconeError = error.message
          ?.toLowerCase()
          .includes("pinecone");

        if (error.status === 429) {
          if (isPineconeError) {
            userFriendlyError =
              "Database Limit Reached. The Arbiter's databanks are sealed for the day (Pinecone Quota).";
          } else {
            userFriendlyError =
              "AI Rate Limit Exceeded. The Arbiter is overloaded with queries. Please wait 60 seconds.";
          }
        } else if (error.status === 503) {
          userFriendlyError =
            "The Arbiter is currently experiencing high demand. Please try again in a few minutes.";
        } else if (error.status === 404) {
          userFriendlyError =
            "Model not found. Ensure you are using the correct Gemini tags.";
        } else {
          userFriendlyError =
            error.message || "An unknown anomaly disrupted the connection.";
        }

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
