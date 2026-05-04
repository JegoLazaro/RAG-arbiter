import { useState, useEffect } from "react";
import { BookOpenText, BookText, ChevronDown, ChevronUp } from "lucide-react";
import { Message } from "../types/chat";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Show } from "@bluelens/nextjs-utils";

export default function ChatMessage({ message }: { message: Message }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const isUser = message.role === "user";
  const [displayedContent, setDisplayedContent] = useState("");

  useEffect(() => {
    // User messages should appear instantly.
    if (isUser) {
      setDisplayedContent(message.content);
      return;
    }

    let currentIndex = 0;
    setDisplayedContent("");

    const typingSpeed = 5; // Adjusted to 5ms (browsers usually cap minimum interval to 4ms anyway)
    const intervalId = setInterval(() => {
      setDisplayedContent(message.content.slice(0, currentIndex + 1));
      currentIndex++;

      // Stop the interval once the whole string is typed
      if (currentIndex >= message.content.length) {
        clearInterval(intervalId);
      }
    }, typingSpeed);

    // Cleanup: Clear the interval if the component unmounts mid-type
    return () => clearInterval(intervalId);
  }, [message.content, isUser]);

  return (
    <div
      className={`flex flex-col w-full mb-4 ${
        isUser 
          ? "ml-auto items-end max-w-fit" 
          : "mr-auto items-start max-w-full"
      }`}
    >
      {/* The Message Bubble */}
      <div
        className={`p-4 shadow-sm transition-colors duration-300 wrap-break-words overflow-hidden w-full ${
          isUser
            ? "bg-orange-600 text-blue-700 rounded-2xl rounded-br-none"
            : "text-gray-800 dark:text-gray-200 rounded-none sm:rounded-2xl sm:rounded-bl-none"
        }`}
      >
        <div
          className={`prose prose-sm max-w-none text-justify ${
            isUser
              ? "prose-invert text-white"
              : "dark:prose-invert text-gray-800 dark:text-gray-200"
          }`}
        >
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              ul: ({ ...props }) => (
                <ul className="list-disc ml-4 space-y-1 mb-2" {...props} />
              ),
              ol: ({ ...props }) => (
                <ol className="list-decimal ml-4 space-y-1 mb-2" {...props} />
              ),
              p: ({ ...props }) => (
                <p className="mb-2 last:mb-0 leading-relaxed" {...props} />
              ),
              strong: ({ ...props }) => (
                <strong
                  className="font-bold text-red-600 dark:text-red-400"
                  {...props}
                />
              ),
              blockquote: ({ ...props }) => (
                <blockquote
                  className="border-l-4 border-gray-300 dark:border-gray-600 pl-4 italic my-4 text-gray-700 dark:text-gray-300"
                  {...props}
                />
              ),
              table: ({ ...props }) => (
                <div className="overflow-x-auto mb-4">
                  <table
                    className="min-w-full divide-y divide-gray-300 dark:divide-gray-700 border border-gray-200 dark:border-gray-800"
                    {...props}
                  />
                </div>
              ),
              thead: ({ ...props }) => (
                <thead className="bg-gray-50 dark:bg-gray-800" {...props} />
              ),
              th: ({ ...props }) => (
                <th
                  className="px-3 py-2 text-left text-sm font-semibold text-gray-900 dark:text-gray-100"
                  {...props}
                />
              ),
              td: ({ ...props }) => (
                <td
                  className="whitespace-nowrap px-3 py-2 text-sm text-gray-600 dark:text-gray-400 border-t border-gray-200 dark:border-gray-800"
                  {...props}
                />
              ),
            }}
          >
            {displayedContent}
          </ReactMarkdown>
        </div>
      </div>

      {/* Grounding Data Accordion */}
      {message.sources && message.sources.length > 0 && (
        <div className="mt-3 w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden shadow-md transition-colors duration-300">
          <div
            className="px-4 py-2 bg-gray-50 dark:bg-gray-800/50 flex justify-between items-center cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 font-medium truncate pr-4">
              <Show>
                <Show.When isTrue={isExpanded}>
                  <BookOpenText className="w-4 h-4 shrink-0" />
                </Show.When>
                <Show.Else>
                  <BookText className="w-4 h-4 shrink-0" />
                </Show.Else>
              </Show>
              <span className="truncate">
                Retrieved Pinecone References ({message.sources.length} sources)
              </span>
            </div>
            <Show>
              <Show.When isTrue={isExpanded}>
                <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" />
              </Show.When>
              <Show.Else>
                <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
              </Show.Else>
            </Show>
          </div>

          <Show>
            <Show.When isTrue={isExpanded}>
              <div className="p-4 space-y-4 max-h-87.5 overflow-y-auto bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800">
                {message.sources.map((src, i) => {
                  const isPlot =
                    src.name.toLowerCase().includes("chapter") ||
                    src.name === "Plot Event";

                  return (
                    <div
                      key={i}
                      className={`text-sm border-l-2 ${
                        i < 5 ? "border-orange-500" : "border-amber-400"
                      } pl-3 py-1`}
                    >
                      <div className="flex flex-wrap justify-between items-center text-xs mb-1.5 gap-2">
                        <div className="flex gap-2 items-center flex-wrap">
                          <span className="font-bold text-gray-900 dark:text-white uppercase tracking-tight break-all">
                            {src.name}
                          </span>
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded font-black uppercase tracking-tighter shrink-0 ${
                              isPlot
                                ? "bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400"
                                : "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                            }`}
                          >
                            {isPlot ? "Manga" : "Lore"}
                          </span>
                        </div>
                        <span className="bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded border border-gray-200 dark:border-gray-700 text-gray-500 font-mono shrink-0">
                          {src.score}% Match
                        </span>
                      </div>

                      <p className="text-gray-600 text-justify dark:text-gray-400 italic transition-all cursor-default wrap-break-words">
                        "
                        {src.text.split(" ").map((word, wordIndex) => (
                          <span
                            key={wordIndex}
                            className="hover:bg-orange-900 hover:rounded-lg hover:text-gray-200 transition-colors duration-150"
                          >
                            {word}{" "}
                          </span>
                        ))}
                        "
                      </p>

                      {src.citations &&
                        Object.keys(src.citations).length > 0 && (
                          <div className="mt-2.5 flex flex-wrap gap-2">
                            {Object.entries(src.citations).map(([key, val]) => (
                              <div
                                key={key}
                                className="text-[11px] text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/40 border border-blue-100 dark:border-blue-800/50 px-2 py-0.5 rounded font-mono break-all"
                              >
                                <span className="opacity-70">{key}:</span>{" "}
                                {String(val)}
                              </div>
                            ))}
                          </div>
                        )}
                    </div>
                  );
                })}
              </div>
            </Show.When>
          </Show>
        </div>
      )}
    </div>
  );
}
