import { ShieldAlert, Sun, Moon, PenBoxIcon } from "lucide-react";
import { Show } from "@bluelens/nextjs-utils";
import { Tooltip } from "@mui/material";

interface HeaderProps {
  isDarkMode: boolean;
  toggleTheme: () => void;
}

export default function Header({ isDarkMode, toggleTheme }: HeaderProps) {

  const handleClearChat = () => {
    localStorage.removeItem("chat_messages");
    window.location.reload(); // Optionally reload to reflect the cleared state
  };

  return (
    <header className="p-5 border-b border-gray-200 dark:border-gray-800 bg-gray-300 dark:bg-gray-900 shadow-md flex items-center justify-between transition-colors duration-300">
      <div className="flex items-center gap-3">
        <ShieldAlert className="text-orange-700 w-8 h-8 dark:text-orange-500" />
        <h1 className="text-2xl font-mono font-bold tracking-wider text-orange-700 dark:text-orange-500">
          JGRL Anime VS Battle (RAG)
        </h1>
      </div>

      <div className="flex items-center gap-4">
        {/* <span className="hidden md:inline-block text-xs text-gray-500 dark:text-gray-400 uppercase tracking-widest border border-gray-800 dark:border-gray-700 px-3 py-1 rounded-full">
          Powered by Fandom.wiki
        </span> */}

        {/* Dark Mode Toggle Button */}
        <Tooltip
          title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
          placement="bottom"
        >
          <button
            onClick={toggleTheme}
            className="relative inline-flex h-8 w-16 items-center rounded-full bg-gray-300 dark:bg-gray-700 transition-colors duration-300 cursor-pointer focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 hover:ring-2 hover:ring-orange-500 hover:ring-offset-2 dark:focus:ring-offset-gray-900"
            aria-label="Toggle Dark Mode"
          >
            <span
              className={`inline-flex h-6 w-6 transform items-center justify-center rounded-full bg-white dark:bg-gray-800 shadow-md transition-transform duration-300 ${
                isDarkMode ? "translate-x-9" : "translate-x-1"
              }`}
            >
              <Show>
                <Show.When isTrue={isDarkMode}>
                  <Moon className="w-3.5 h-3.5 text-gray-200" />
                </Show.When>
                <Show.Else>
                  <Sun className="w-3.5 h-3.5 text-yellow-400" />
                </Show.Else>
              </Show>
            </span>
          </button>
        </Tooltip>
        <Tooltip
            title="Clear chat history and start a new chat with JGRL?"
            placement="bottom"
          >
            <button
              onClick={handleClearChat}
              className="px-5 cursor-pointer py-1.5 rounded-2xl bg-orange-600 hover:bg-orange-700 transition"
            >
              <PenBoxIcon className="w-5 h-5 text-white" />
            </button>
          </Tooltip>
      </div>
    </header>
  );
}
