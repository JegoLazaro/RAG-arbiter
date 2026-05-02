import { Send } from "lucide-react";

interface ChatInputProps {
  isDarkMode: boolean;
  toggleTheme: () => void;
  input: string;
  setInput: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  isLoading: boolean;
}

export default function ChatInput({
  input,
  setInput,
  onSubmit,
  isLoading,
  isDarkMode,
  toggleTheme,
}: ChatInputProps) {
  return (
    <div className="p-4 px-10 dark:bg-gray-900 bg-gray-300 border-t border-gray-800">
      <form
        onSubmit={onSubmit}
        className="max-w-4xl mx-auto relative flex items-center"
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (!isLoading && input.trim()) {
                onSubmit(e as unknown as React.FormEvent);
              }
            }
          }}
          placeholder="E.g., How does Gojo's infinity work?"
          className="w-full resize-none dark:bg-gray-800 bg-gray-400 text-black dark:text-gray-100 border border-gray-700 rounded-2xl pl-6 pr-14 py-4 focus:outline-none focus:border-orange-500 transition-colors overflow-y-auto"
          disabled={isLoading}
          rows={1}
          style={{ lineHeight: "1.5" }}
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="absolute right-2 p-2 bg-orange-500 hover:bg-orange-600 text-white rounded-full transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Send className="w-5 h-5" />
        </button>
      </form>
    </div>
  );
}