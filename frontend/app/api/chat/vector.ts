import { Pinecone } from "@pinecone-database/pinecone";

export interface CitationSource {
  name: string;
  text: string;
  score: string;
  citations: any;
  type: "chronicle" | "lore";
  universe: string;
}

export interface PineconeQueryResult {
  finalSources: CitationSource[];
  loreContext: string;
}

export const queryPinecone = async (
  pc: Pinecone,
  namespaces: string[],
  vector: number[],
  sendStatus: (msg: string) => void
): Promise<PineconeQueryResult> => {
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

  const finalSources: CitationSource[] = validMatches.map((match) => {
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

  return {
    finalSources,
    loreContext,
  };
};
