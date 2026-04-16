import { useState } from "react";
import { BookOpen, ChevronDown, ChevronUp } from "lucide-react";
import { Message } from "../types/chat";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function ChatMessage({ message }: { message: Message }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const isUser = message.role === "user";

  return (
    <div
      className={`flex flex-col max-w-3xl w-full ${isUser ? "ml-auto items-end" : "mr-auto items-start"}`}
    >
      {/* The Message Bubble */}
      <div
        className={`p-4 rounded-2xl shadow-sm transition-colors duration-300 ${
          isUser
            ? "bg-orange-600 text-white rounded-br-none"
            : "bg-gray-200 dark:bg-gray-800 text-gray-800 dark:text-gray-200 border border-gray-300 dark:border-gray-700 rounded-bl-none"
        }`}
      >
        <div
          className={`prose prose-sm max-w-none ${isUser ? "prose-invert text-white" : "dark:prose-invert text-gray-800 dark:text-gray-200"}`}
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
            }}
          >
            {message.content}
          </ReactMarkdown>
        </div>
      </div>

      {/* The Grounding Data Accordion */}
      {message.sources && message.sources.length > 0 && (
        <div className="mt-3 w-full max-w-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden shadow-md transition-colors duration-300">
          <div
            className="px-4 py-2 bg-gray-50 dark:bg-gray-800/50 flex justify-between items-center cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 font-medium">
              <BookOpen className="w-4 h-4" />
              <span>
                View Grounding Data ({message.sources.length} sources)
              </span>
            </div>
            {isExpanded ? (
              <ChevronUp className="w-4 h-4 text-gray-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-gray-400" />
            )}
          </div>

          {isExpanded && (
            <div className="p-4 space-y-4 bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800">
              {message.sources.map((src, i) => {
                // Determine if this is a Chapter/Plot source vs a Character source
                const isPlot =
                  src.name.toLowerCase().includes("chapter") ||
                  src.name === "Plot Event";

                return (
                  <div
                    key={i}
                    className="text-sm border-l-2 border-orange-500 pl-3 py-1"
                  >
                    <div className="flex justify-between items-center text-xs mb-1.5">
                      <div className="flex gap-2 items-center">
                        <span className="font-bold text-gray-900 dark:text-white uppercase tracking-tight">
                          {src.name}
                        </span>
                        {/* THE NEW BADGE */}
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded font-black uppercase tracking-tighter ${
                            isPlot
                              ? "bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400"
                              : "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                          }`}
                        >
                          {isPlot ? "Chronicle" : "Lore"}
                        </span>
                      </div>
                      <span className="bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded border border-gray-200 dark:border-gray-700 text-gray-500 font-mono">
                        {src.score}% Match
                      </span>
                    </div>

                    <p className="text-gray-600 dark:text-gray-400 italic line-clamp-3 hover:line-clamp-none transition-all cursor-default">
                      "{src.text}"
                    </p>

                    {src.citations && Object.keys(src.citations).length > 0 && (
                      <div className="mt-2.5 flex flex-wrap gap-2">
                        {Object.entries(src.citations).map(([key, val]) => (
                          <div
                            key={key}
                            className="text-[11px] text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/40 border border-blue-100 dark:border-blue-800/50 px-2 py-0.5 rounded font-mono"
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
          )}
        </div>
      )}
    </div>
  );
}
