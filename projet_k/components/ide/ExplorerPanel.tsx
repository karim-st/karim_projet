import { ChevronDown, FileJson2, MoreHorizontal, Puzzle } from "lucide-react";
import { Card } from "../ui/Card";
import { useClockStore } from "../../store/clockStore";
import { TerminalPanel } from "./TerminalPanel";

type OpenFile = {
  id: string;
  name: string;
  content: string;
};

export function ExplorerPanel() {
  const activePanel = useClockStore((s) => s.activePanel);
  const openFiles = useClockStore((s) => s.openFiles);
  const activeFileId = useClockStore((s) => s.activeFileId);
  const showEditor = useClockStore((s) => s.showEditor);
  const setActiveFileId = useClockStore((s) => s.setActiveFileId);
  const setShowEditor = useClockStore((s) => s.setShowEditor);

  const handleFileClick = (fileId: string) => {
    if (activeFileId === fileId && showEditor) {
      setShowEditor(false);
      return;
    }
    setActiveFileId(fileId);
    setShowEditor(true);
  };

  if (activePanel === "extensions") {
    return (
      <div className="w-64 border-r border-gray-200 bg-white">
        <div className="flex h-10 items-center justify-between border-b border-gray-200 px-3 text-xs font-semibold uppercase text-gray-500">
          <span>Extensions</span>
          <MoreHorizontal size={14} />
        </div>
        <div className="space-y-2 p-3">
          <Card className="bg-gray-50 p-3 text-sm">
            <div className="flex items-center gap-2 font-semibold text-gray-700">
              <Puzzle size={14} />
              Clock Creator Extension Pack
            </div>
            <div className="mt-1 text-xs text-gray-500">
              Diagram tools, JSON helpers, validation.
            </div>
          </Card>
        </div>
      </div>
    );
  }

  if (activePanel === "search") {
    return (
      <div className="w-64 border-r border-gray-200 bg-white">
        <div className="flex h-10 items-center justify-between border-b border-gray-200 px-3 text-xs font-semibold uppercase text-gray-500">
          <span>Search</span>
          <MoreHorizontal size={14} />
        </div>
        <div className="p-3">
          <input
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none"
            placeholder="Search in workspace..."
          />
        </div>
      </div>
    );
  }

  if (activePanel === "sourceControl") {
    return (
      <div className="w-64 border-r border-gray-200 bg-white">
        <div className="flex h-10 items-center justify-between border-b border-gray-200 px-3 text-xs font-semibold uppercase text-gray-500">
          <span>Source Control</span>
          <MoreHorizontal size={14} />
        </div>
        <div className="p-3 text-sm text-gray-500">
          No source control provider connected.
        </div>
      </div>
    );
  }

  if (activePanel === "run") {
    return (
      <div className="w-64 border-r border-gray-200 bg-white">
        <div className="flex h-10 items-center justify-between border-b border-gray-200 px-3 text-xs font-semibold uppercase text-gray-500">
          <span>Run</span>
          <MoreHorizontal size={14} />
        </div>
        <div className="p-3 text-sm text-gray-500">
          Run / validation tools will appear here.
        </div>
      </div>
    );
  }

  if (activePanel === "settings") {
    return (
      <div className="w-64 border-r border-gray-200 bg-white">
        <div className="flex h-10 items-center justify-between border-b border-gray-200 px-3 text-xs font-semibold uppercase text-gray-500">
          <span>Settings</span>
          <MoreHorizontal size={14} />
        </div>
        <div className="p-3 text-sm text-gray-500">
          Application settings will be available here.
        </div>
      </div>
    );
  }

  if (activePanel === "terminal") {
    return <TerminalPanel />;
  }

  return (
    <div className="w-64 border-r border-gray-200 bg-white">
      <div className="flex h-10 items-center justify-between border-b border-gray-200 px-3 text-xs font-semibold uppercase text-gray-500">
        <span>Explorer</span>
        <MoreHorizontal size={14} />
      </div>

      <div className="space-y-3 p-3">
        <Card className="bg-gray-50 p-2">
          <div className="mb-2 flex items-center gap-2 text-[12px] font-semibold text-gray-700">
            <ChevronDown size={14} />
            OPEN EDITORS
          </div>

          <div className="space-y-1">
            {openFiles.map((file: OpenFile) => (
              <button
                key={file.id}
                onClick={() => handleFileClick(file.id)}
                className={`flex w-full items-center gap-2 rounded px-2 py-1 text-left text-[12px] ${
                  file.id === activeFileId
                    ? "bg-[#17146E]/10 text-[#17146E]"
                    : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                <FileJson2 size={14} />
                {file.name}
              </button>
            ))}
          </div>
        </Card>

        <Card className="bg-gray-50 p-2">
          <div className="mb-2 flex items-center gap-2 text-[12px] font-semibold text-gray-700">
            <ChevronDown size={14} />
            WORKSPACE
          </div>

          <div className="space-y-1">
            {openFiles.map((file: OpenFile) => (
              <button
                key={file.id}
                onClick={() => handleFileClick(file.id)}
                className={`flex w-full items-center gap-2 rounded px-2 py-1 text-left text-[12px] ${
                  file.id === activeFileId
                    ? "bg-gray-100 text-gray-900"
                    : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                <FileJson2 size={14} />
                {file.name}
              </button>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}