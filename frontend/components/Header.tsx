import { ShieldAlert, ShieldHalf, Sword } from "lucide-react";

export default function Header() {
  return (
    <header className="p-5 border-b border-gray-800 bg-gray-900 shadow-md flex items-center justify-between">
      <div className="flex items-center gap-3">
        <ShieldHalf className="text-red-500 w-8 h-8" />

        <h1 className="text-2xl font-bold tracking-wider text-red-500">
          JGRL-VS Battle
        </h1>
        <Sword className="text-red-500 w-8 h-8" />
      </div>
      <span className="text-xs text-gray-500 uppercase tracking-widest border border-gray-700 px-3 py-1 rounded-full">
        Jujutsu Kaisen Core
      </span>
    </header>
  );
}
