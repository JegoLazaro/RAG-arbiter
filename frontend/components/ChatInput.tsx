import { Send } from 'lucide-react';

interface ChatInputProps {
  input: string;
  setInput: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  isLoading: boolean;
}

export default function ChatInput({ input, setInput, onSubmit, isLoading }: ChatInputProps) {
  return (
    <div className="p-4 px-10 bg-gray-900 border-t border-gray-800">
      <form onSubmit={onSubmit} className="max-w-4xl mx-auto relative flex items-center">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="E.g., How does Gojo's infinity work?"
          className="w-full bg-gray-800 text-gray-100 border border-gray-700 rounded-full pl-6 pr-14 py-4 focus:outline-none focus:border-red-500 transition-colors"
          disabled={isLoading}
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="absolute right-2 p-2 bg-red-600 hover:bg-red-500 text-white rounded-full transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Send className="w-5 h-5 ml-0.5" />
        </button>
      </form>
    </div>
  );
}