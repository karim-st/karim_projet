import {
  Filter,
  PanelBottomClose,
  PanelBottomOpen,
  X,
  Info,
  Bug,
  TerminalSquare,
  Plug,
  GripVertical
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useClockStore } from "../../store/clockStore";

type BottomTab = "output" | "debug" | "terminal" | "ports";

type BottomLog = {
  level: "info" | "warn" | "error" | "debug";
  text: string;
  time: string;
};

const tabs: {
  key: BottomTab;
  label: string;
  icon: React.ComponentType<any>;
}[] = [
  { key: "output", label: "OUTPUT", icon: Info },
  { key: "debug", label: "DEBUG CONSOLE", icon: Bug },
  { key: "terminal", label: "TERMINAL", icon: TerminalSquare },
  { key: "ports", label: "PORTS", icon: Plug }
];

export function BottomPanel() {
  const bottomPanelVisible = useClockStore((s) => s.bottomPanelVisible);
  const bottomPanelHeight = useClockStore((s) => s.bottomPanelHeight);
  const setBottomPanelVisible = useClockStore((s) => s.setBottomPanelVisible);
  const toggleBottomPanel = useClockStore((s) => s.toggleBottomPanel);
  const setBottomPanelHeight = useClockStore((s) => s.setBottomPanelHeight);

  const activeBottomTab = useClockStore((s) => s.activeBottomTab);
  const setActiveBottomTab = useClockStore((s) => s.setActiveBottomTab);
  const logs = useClockStore((s) => s.logs as BottomLog[]);
  const clearLogs = useClockStore((s) => s.clearLogs);

  const [filter, setFilter] = useState("");

  const resizeRef = useRef(false);
  const startYRef = useRef(0);
  const startHeightRef = useRef(bottomPanelHeight);

  const filteredLogs = useMemo(() => {
    if (!filter.trim()) return logs;
    const value = filter.toLowerCase();
    return logs.filter(
      (log) =>
        log.text.toLowerCase().includes(value) ||
        log.time.toLowerCase().includes(value)
    );
  }, [logs, filter]);

  const onResizeStart = (e: React.MouseEvent) => {
    resizeRef.current = true;
    startYRef.current = e.clientY;
    startHeightRef.current = bottomPanelHeight;

    const onMouseMove = (ev: MouseEvent) => {
      if (!resizeRef.current) return;
      const diff = startYRef.current - ev.clientY;
      const nextHeight = Math.max(120, Math.min(600, startHeightRef.current + diff));
      setBottomPanelHeight(nextHeight);
    };

    const onMouseUp = () => {
      resizeRef.current = false;
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  if (!bottomPanelVisible) {
    return (
      <div className="flex items-center justify-between border-t border-[#3a3d41] bg-[#1e1e1e] px-2 py-1 text-[11px] text-gray-300">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setBottomPanelVisible(true)}
            className="rounded p-1 hover:bg-[#2a2d2e]"
            title="Show panel"
          >
            <PanelBottomOpen size={14} />
          </button>
          <span>Panel hidden</span>
        </div>
        <div className="text-gray-500">Terminal / Output</div>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col border-t border-[#3a3d41] bg-[#1e1e1e] text-[12px] text-gray-200"
      style={{ height: bottomPanelHeight }}
    >
      <div
        onMouseDown={onResizeStart}
        className="flex h-1 cursor-row-resize items-center justify-center bg-[#252526]"
        title="Resize panel"
      >
        <GripVertical size={12} className="text-gray-500" />
      </div>

      <div className="flex h-9 items-center justify-between border-b border-[#3a3d41] px-2">
        <div className="flex items-center gap-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeBottomTab === tab.key;

            return (
              <button
                key={tab.key}
                onClick={() => setActiveBottomTab(tab.key)}
                className={`flex items-center gap-1 rounded px-3 py-1 text-[11px] uppercase tracking-wide ${
                  active ? "bg-[#2a2d2e] text-white" : "text-gray-400 hover:bg-[#2a2d2e]"
                }`}
              >
                <Icon size={12} />
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 rounded border border-[#3c3c3c] bg-[#252526] px-2 py-1 text-gray-300">
            <Filter size={12} />
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter (text only)"
              className="w-[280px] bg-transparent text-[11px] outline-none placeholder:text-gray-500"
            />
          </div>

          <button
            className="rounded p-1 hover:bg-[#2a2d2e]"
            title="Hide panel"
            onClick={toggleBottomPanel}
          >
            <PanelBottomClose size={14} />
          </button>

          <button
            onClick={clearLogs}
            className="rounded p-1 hover:bg-[#2a2d2e]"
            title="Clear Logs"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-3">
        {activeBottomTab === "output" && (
          <div className="space-y-2">
            <div className="text-sm font-semibold text-white">Output</div>
            {filteredLogs.length === 0 ? (
              <div className="text-gray-500">No output yet.</div>
            ) : (
              filteredLogs.map((log, index: number) => (
                <div key={index} className="text-gray-300">
                  <span className="text-gray-500">[{log.time}]</span>{" "}
                  <span
                    className={
                      log.level === "error"
                        ? "text-red-400"
                        : log.level === "warn"
                          ? "text-yellow-400"
                          : log.level === "debug"
                            ? "text-cyan-400"
                            : "text-gray-200"
                    }
                  >
                    {log.text}
                  </span>
                </div>
              ))
            )}
          </div>
        )}

        {activeBottomTab === "debug" && (
          <div className="space-y-2">
            <div className="text-sm font-semibold text-white">Debug Console</div>
            {filteredLogs.length === 0 ? (
              <div className="text-gray-500">No debug messages.</div>
            ) : (
              filteredLogs.map((log, index: number) => (
                <div key={index} className="font-mono text-gray-300">
                  <span className="text-gray-500">[{log.time}]</span> {log.text}
                </div>
              ))
            )}
          </div>
        )}

        {activeBottomTab === "terminal" && (
          <div className="space-y-2 font-mono text-[11px] text-gray-200">
            <div className="text-sm font-semibold text-white">Terminal</div>
            {filteredLogs.length === 0 ? (
              <div>$ no output</div>
            ) : (
              filteredLogs.map((log, index: number) => (
                <div key={index}>
                  <span className="text-gray-500">[{log.time}]</span> {log.text}
                </div>
              ))
            )}
          </div>
        )}

        {activeBottomTab === "ports" && (
          <div className="space-y-2">
            <div className="text-sm font-semibold text-white">Ports</div>
            <div className="text-gray-400">No forwarded ports available.</div>
          </div>
        )}
      </div>
    </div>
  );
}