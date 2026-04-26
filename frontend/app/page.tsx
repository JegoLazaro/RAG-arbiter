"use client";

import { useEffect, useState } from "react";
import Header from "../components/Header";
import ChatMessage from "../components/ChatMessage";
import ChatInput from "../components/ChatInput";
import { Message } from "../types/chat";
import { Each, Show } from "@bluelens/nextjs-utils";

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "arbiter",
      content:
        "Welcome to the VS Battle. Present your matchup or lore question, and I shall consult the sacred texts.",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [loadingLogs, setLoadingLogs] = useState<string[]>([]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMsg: Message = { role: "user", content: input };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);
    setLoadingLogs(["Initiating link to Anime Arbiter..."]);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [...messages, userMsg] }),
      });

      // Catch direct HTTP errors (if the server crashes before streaming starts)
      if (!response.ok) {
        let errorMsg = `Server error: ${response.status}`;
        if (response.status === 429) {
          errorMsg =
            "Rate Limit Exceeded. The Arbiter's cursed energy is depleted for today.";
        } else if (response.status === 500) {
          errorMsg =
            "Internal Server Error. Gemini API quota may be exhausted.";
        }
        throw new Error(errorMsg);
      }

      if (!response.body) throw new Error("No response body received.");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n").filter((line) => line.trim() !== "");

        for (const line of lines) {
          let data;
          try {
            data = JSON.parse(line);
          } catch (err) {
            continue;
          }

          if (data.type === "status") {
            setLoadingLogs((prev) => [...prev, data.message]);

            if (data.message.toLowerCase().includes("error:")) {
              const cleanError = data.message.replace(/error:\s/i, "");
              setMessages((prev) => [
                ...prev,
                {
                  role: "arbiter",
                  content: `⚠️ **System Override:** ${cleanError}`,
                },
              ]);
              break;
            }
          } else if (data.type === "result") {
            setMessages((prev) => [
              ...prev,
              {
                role: "arbiter",
                content: data.answer,
                sources: data.sources,
              },
            ]);
          }
        }
      }
    } catch (error: any) {
      console.error("Caught in frontend:", error);

      // Push the final error to the terminal
      setLoadingLogs((prev) => [
        ...prev,
        `❌ System Failure: ${error.message}`,
      ]);

      // Drop error bubble into the chat
      setMessages((prev) => [
        ...prev,
        {
          role: "arbiter",
          content: `⚠️ **SYSTEM ALERT:** ${error.message || "Failed to establish a connection. Please try again later."}`,
        },
      ]);
    } finally {
      setIsLoading(false);
      // wait time for user to read the final log before clearing
      setTimeout(() => setLoadingLogs([]), 6000);
    }
  };

  const [isDarkMode, setIsDarkMode] = useState(true);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [isDarkMode]);

  return (
    <main className="flex flex-col h-screen bg-gray-400 dark:bg-gray-950 text-gray-100 font-sans">
      <Header
        isDarkMode={isDarkMode}
        toggleTheme={() => setIsDarkMode(!isDarkMode)}
      />

      <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6">
        {messages.map((m, index) => (
          <ChatMessage key={index} message={m} />
        ))}

        <Show>
          <Show.When isTrue={isLoading}>
            <div className="mr-auto p-4 bg-gray-900 rounded-2xl rounded-bl-none border border-gray-700 max-w-sm text-gray-400 font-mono text-xs shadow-lg">
              <div className="flex items-center gap-2 mb-2 text-purple-500 font-bold uppercase tracking-wider">
                <span className="w-2 h-2 bg-purple-500 rounded-full animate-ping"></span>
                System Terminal
              </div>
              <div className="space-y-1">
                <Each
                  of={loadingLogs}
                  render={(log, i) => (
                    <div
                      key={i}
                      className={
                        i === loadingLogs.length - 1
                          ? "text-gray-200"
                          : "text-gray-500"
                      }
                    >
                      <span className="text-gray-600 mr-2">{">"}</span> {log}
                    </div>
                  )}
                />
              </div>
            </div>
          </Show.When>
        </Show>
      </div>

      <ChatInput
        isDarkMode={isDarkMode}
        toggleTheme={() => setIsDarkMode(!isDarkMode)}
        input={input}
        setInput={setInput}
        onSubmit={handleSubmit}
        isLoading={isLoading}
      />
      {/* <Footer /> */}
    </main>
  );
}
