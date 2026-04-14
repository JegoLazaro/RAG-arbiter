import { useState } from 'react';
import { BookOpen, ChevronDown, ChevronUp } from 'lucide-react';
import { Message } from '../types/chat';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';


export default function ChatMessage({ message }: { message: Message } ) {
  const [isExpanded, setIsExpanded] = useState(false);
  const isUser = message.role === 'user';

  return (
    <div className={`flex flex-col max-w-3xl w-full ${isUser ? 'ml-auto items-end' : 'mr-auto items-start'}`}>
      
      {/* The Message Bubble */}
      <div className={`p-4 rounded-2xl shadow-sm ${
        isUser 
          ? 'bg-orange-600 text-white rounded-br-none' 
          : 'dark:bg-gray-800 text-black bg-gray-300 dark:text-gray-200 border border-gray-700 rounded-bl-none'
      }`}>
        {/* Put the Markdown inside this div! */}
        <div className={`prose prose-sm max-w-none ${isUser ? 'prose-invert' : 'dark:prose-invert'}`}>
          <ReactMarkdown 
            remarkPlugins={[remarkGfm]}
            components={{
              ul: ({...props}) => <ul className="list-disc ml-4 space-y-1 mb-2" {...props} />,
              ol: ({...props}) => <ol className="list-decimal ml-4 space-y-1 mb-2" {...props} />,
              // Use a div or adjust p margins so it doesn't add double spacing
              p: ({...props}) => <p className="mb-2 last:mb-0 leading-relaxed" {...props} />,
              strong: ({...props}) => <strong className="font-bold text-red-500 dark:text-red-400" {...props} />,
            }}
          >
            {message.content}
          </ReactMarkdown>
        </div>
      </div>

      {/* The Grounding Data Accordion (No changes needed here) */}
      {message.sources && message.sources.length > 0 && (
        <div className="mt-3 w-full max-w-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden shadow-md">
          <div 
            className="px-4 py-2 bg-gray-50 dark:bg-gray-800/50 flex justify-between items-center cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
              <BookOpen className="w-4 h-4" />
              <span>View Grounding Data ({message.sources.length} sources)</span>
            </div>
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
          
          {isExpanded && (
            <div className="p-4 space-y-4 bg-white dark:bg-gray-900">
              {message.sources.map((src, i) => (
                <div key={i} className="text-sm border-l-2 border-red-500 pl-3">
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span className="font-bold text-red-500 dark:text-red-400">{src.name}</span>
                    <span className="bg-gray-100 dark:bg-gray-800 px-2 rounded border border-gray-200 dark:border-gray-700">Match: {src.score}%</span>
                  </div>
                  <p className="text-gray-600 dark:text-gray-400 italic">"{src.text}"</p>
                  
                  {src.citations && Object.keys(src.citations).length > 0 && (
                    <div className="mt-2 text-xs text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 inline-block px-2 py-1 rounded">
                      {Object.entries(src.citations).map(([key, val]) => (
                        <span key={key} className="mr-3 font-mono">{key}: {String(val)}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}