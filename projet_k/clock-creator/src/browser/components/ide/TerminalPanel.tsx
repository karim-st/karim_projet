import { useState } from "react";
import { useClockStore } from "../../store/clockStore";

export function TerminalPanel() {
  const [input, setInput] = useState("");
  const pushLog = useClockStore((s) => s.pushLog);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    pushLog(`$ ${input}`, "info");
    pushLog(`Command "${input}" is not recognized.`, "warn");
    setInput("");
  };

  return (
    <div className="w-64 border-r border-gray-200 bg-[#1e1e1e] text-gray-200">
      <div className="flex h-10 items-center justify-between border-b border-[#3a3d41] px-3 text-xs font-semibold uppercase text-gray-400">
        <span>Terminal</span>
      </div>
      <div className="p-3">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <span className="text-green-400">$</span>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="flex-1 bg-transparent text-sm text-gray-200 outline-none"
            placeholder="Type a command..."
          />
        </form>
      </div>
    </div>
  );
}
