export const getQueryIntent = async (
  routerModel: any,
  routerPrompt: string
): Promise<{ requires_lore: boolean; namespaces: string[]; search_query: string }> => {
  try {
    const routerResult = await routerModel.generateContent(routerPrompt);
    return JSON.parse(routerResult.response.text());
  } catch (geminiError) {
    console.warn("Gemini intent router failed, falling back to backup LLM:", geminiError);
    if (!process.env.BACKUP_API_KEY) {
      throw geminiError;
    }

    const backupRes = await fetch(`${process.env.BACKUP_API_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.BACKUP_API_KEY}`,
      },
      body: JSON.stringify({
        model: process.env.BACKUP_CHAT_MODEL || "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: routerPrompt }],
        response_format: { type: "json_object" },
        temperature: 0.1,
      }),
    });

    if (!backupRes.ok) {
      throw new Error(`Backup fallback failed during routing: ${await backupRes.text()}`);
    }

    const data = await backupRes.json();
    return JSON.parse(data.choices[0].message.content);
  }
};

export const generateSynthesis = async (
  chatModel: any,
  finalPrompt: string,
  sendStatus: (msg: string) => void
): Promise<string> => {
  try {
    const result = await chatModel.generateContent(finalPrompt);
    return result.response.text();
  } catch (geminiError) {
    console.warn("Gemini synthesis failed, falling back to backup LLM:", geminiError);
    sendStatus("Gemini API connection error. Routing request to backup server...");

    if (!process.env.BACKUP_API_KEY) {
      throw new Error("Primary model connection failed, and no backup credentials are configured.");
    }

    const backupRes = await fetch(`${process.env.BACKUP_API_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.BACKUP_API_KEY}`,
      },
      body: JSON.stringify({
        model: process.env.BACKUP_CHAT_MODEL || "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: finalPrompt }],
        temperature: 0.7,
      }),
    });

    if (!backupRes.ok) {
      throw new Error(`Backup fallback failed during synthesis: ${await backupRes.text()}`);
    }

    const data = await backupRes.json();
    sendStatus("Verdict generated successfully via backup server.");
    return data.choices[0].message.content;
  }
};
