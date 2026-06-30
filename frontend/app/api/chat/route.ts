import { NextRequest } from "next/server";
import { Pinecone } from "@pinecone-database/pinecone";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { ratelimit } from "./ratelimit";
import { getRouterPrompt, getArbiterPrompt, getGeneralPrompt } from "./prompts";
import { getQueryIntent, generateSynthesis } from "./llm";
import { queryPinecone } from "./vector";

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") ?? "127.0.0.1";

  let success = true;
  try {
    const res = await ratelimit.limit(ip);
    success = res.success;
    console.log("Upstash Redis working!");
  } catch (error) {
    console.error("Upstash rate limit check failed, bypassing check:", error);
  }

  if (!success) {
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
          model: process.env.GEMINI_CHAT_MODEL || "gemini-2.5-flash",
        });

        const routerModel = genAI.getGenerativeModel({
          model: process.env.GEMINI_CHAT_MODEL || "gemini-2.5-flash",
          generationConfig: { responseMimeType: "application/json" },
        });

        sendStatus("Analyzing query intent...");

        const historyString =
          messages.length > 1
            ? messages
              .slice(0, -1)
              .map((m: any) => `${m.role.toUpperCase()}: ${m.content}`)
              .join("\n")
            : "";

        const routerPrompt = getRouterPrompt(historyString, latestMessage);

        const { requires_lore, namespaces, search_query } = await getQueryIntent(
          routerModel,
          routerPrompt
        );

        let finalPrompt = "";
        let finalSources: any[] = [];

        if (requires_lore) {
          const safeQuery = search_query || latestMessage;
          historyString.length > 0
            ? sendStatus(`Memory accessed. Vectorizing query: "${safeQuery}"...`)
            : sendStatus("Vectorizing query to 3,072 dimensions...");

          const embedRes = await embeddingModel.embedContent(safeQuery);
          const vector = embedRes.embedding.values;

          const queryResult = await queryPinecone(
            pc,
            namespaces,
            vector,
            sendStatus
          );

          finalSources = queryResult.finalSources;
          const loreContext = queryResult.loreContext;

          sendStatus("Synthesizing Arbiter verdict based on grounding data...");
          finalPrompt = getArbiterPrompt(loreContext, latestMessage);
        } else {
          sendStatus("General inquiry detected. Bypassing databanks...");
          finalPrompt = getGeneralPrompt(latestMessage);
        }

        const synthesizedAnswer = await generateSynthesis(
          chatModel,
          finalPrompt,
          sendStatus
        );

        const finalPayload = JSON.stringify({
          type: "result",
          answer: synthesizedAnswer,
          sources: finalSources,
        });
        controller.enqueue(new TextEncoder().encode(finalPayload + "\n"));

        // Close stream
        controller.close();
      } catch (error: any) {
        console.error("API Error:", error);

        let userFriendlyError = "An anomaly disrupted the connection.";

        // Check if error message specifically mentions Pinecone
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

  // Return the stream immediately
  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-cache",
    },
  });
}
