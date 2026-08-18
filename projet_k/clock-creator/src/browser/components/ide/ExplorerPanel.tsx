import { useEffect } from "react";
import { ChevronDown, FileJson2, FolderOpen, MoreHorizontal, Moon, Puzzle, RefreshCw, Sun } from "lucide-react";
import { Card } from "../ui/Card";
import { useClockStore } from "../../store/clockStore";
import { TerminalPanel } from "./TerminalPanel";
import { applyTheiaTheme } from "../../utils/theiaTheme";

type OpenFile = {
  id: string;
  name: string;
  content: string;
};

export function ExplorerPanel() {
  const activePanel = useClockStore((s) => s.activePanel);
  const openFiles = useClockStore((s) => s.openFiles);
  const workspaceFiles = useClockStore((s) => s.workspaceFiles);
  const activeFileId = useClockStore((s) => s.activeFileId);
  const activeProjectFile = useClockStore((s) => s.activeProjectFile);
  const showEditor = useClockStore((s) => s.showEditor);
  const setActiveFileId = useClockStore((s) => s.setActiveFileId);
  const setShowEditor = useClockStore((s) => s.setShowEditor);
  const requestOpenWorkspaceFile = useClockStore((s) => s.requestOpenWorkspaceFile);
  const pushLog = useClockStore((s) => s.pushLog);
  const darkMode = useClockStore((s) => s.darkMode);
  const toggleDarkMode = useClockStore((s) => s.toggleDarkMode);

  useEffect(() => {
    applyTheiaTheme(darkMode);
  }, [darkMode]);

  const handleOpenEditorClick = (fileId: string) => {
    if (activeFileId === fileId && showEditor) {
      setShowEditor(false);
      return;
    }
    setActiveFileId(fileId);
    setShowEditor(true);
  };

  const handleWorkspaceFileClick = (fileName: string) => {
    requestOpenWorkspaceFile(fileName);
    setShowEditor(true);
  };

  if (activePanel === "extensions") {
    return (
      <div className="w-64 border-r border-gray-200 dark:border-slate-700 bg-white dark:border-r-slate-700 dark:bg-[#121c2b]">
        <div className="flex h-10 items-center justify-between border-b border-gray-200 dark:border-slate-700 px-3 text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">
          <span>Extensions</span>
          <MoreHorizontal size={14} />
        </div>
        <div className="space-y-2 p-3">
          <Card className="bg-gray-50 dark:bg-slate-800 p-3 text-sm">
            <div className="flex items-center gap-2 font-semibold text-gray-700 dark:text-slate-200">
              <Puzzle size={14} />
              Clock Creator Extension Pack
            </div>
            <div className="mt-1 text-xs text-gray-500 dark:text-slate-400">
              Diagram tools, JSON helpers, validation.
            </div>
          </Card>
        </div>
      </div>
    );
  }

  if (activePanel === "search") {
    return (
      <div className="w-64 border-r border-gray-200 dark:border-slate-700 bg-white dark:border-r-slate-700 dark:bg-[#121c2b]">
        <div className="flex h-10 items-center justify-between border-b border-gray-200 dark:border-slate-700 px-3 text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">
          <span>Search</span>
          <MoreHorizontal size={14} />
        </div>
        <div className="p-3">
          <input
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none dark:border-slate-600 dark:bg-[#0f1a2a] dark:text-slate-100"
            placeholder="Search in workspace..."
          />
        </div>
      </div>
    );
  }

  if (activePanel === "sourceControl") {
    return (
      <div className="w-64 border-r border-gray-200 dark:border-slate-700 bg-white dark:border-r-slate-700 dark:bg-[#121c2b]">
        <div className="flex h-10 items-center justify-between border-b border-gray-200 dark:border-slate-700 px-3 text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">
          <span>Source Control</span>
          <MoreHorizontal size={14} />
        </div>
        <div className="p-3 text-sm text-gray-500 dark:text-slate-400">
          No source control provider connected.
        </div>
      </div>
    );
  }

  if (activePanel === "run") {
    return (
      <div className="w-64 border-r border-gray-200 dark:border-slate-700 bg-white dark:border-r-slate-700 dark:bg-[#121c2b]">
        <div className="flex h-10 items-center justify-between border-b border-gray-200 dark:border-slate-700 px-3 text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">
          <span>Run</span>
          <MoreHorizontal size={14} />
        </div>
        <div className="p-3 text-sm text-gray-500 dark:text-slate-400">
          Run / validation tools will appear here.
        </div>
      </div>
    );
  }

  if (activePanel === "settings") {
    return (
      <div className="w-64 border-r border-gray-200 dark:border-slate-700 bg-white dark:border-r-slate-700 dark:bg-[#121c2b]">
        <div className="flex h-10 items-center justify-between border-b border-gray-200 dark:border-slate-700 px-3 text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">
          <span>Settings</span>
          <MoreHorizontal size={14} />
        </div>
        <div className="p-3 text-sm text-gray-500 dark:text-slate-400">
          Application settings will be available here.
        </div>
      </div>
    );
  }

  if (activePanel === "terminal") {
    return <TerminalPanel />;
  }

  const projectFiles = workspaceFiles.length
    ? workspaceFiles
    : openFiles.map((f) => ({ name: f.name, uri: f.id }));

  return (
    <div className="flex h-full w-full flex-col border-r border-gray-200 dark:border-slate-700 bg-white dark:border-r-slate-700 dark:bg-[#121c2b]">
      <div className="flex h-10 items-center justify-between border-b border-gray-200 dark:border-slate-700 px-3 text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">
        <span>Explorer</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            title={darkMode ? "Mode clair (tout le système)" : "Mode sombre (tout le système)"}
            aria-label={darkMode ? "Mode clair" : "Mode sombre"}
            className="rounded p-1 text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700 hover:text-gray-800 dark:hover:text-slate-100"
            onClick={toggleDarkMode}
          >
            {darkMode ? <Sun size={14} /> : <Moon size={14} />}
          </button>
          <button
            type="button"
            title="Refresh workspace files"
            className="rounded p-1 text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700 hover:text-gray-800 dark:hover:text-slate-100"
            onClick={() => {
              pushLog("Refresh workspace files requested", "info");
              requestOpenWorkspaceFile("__refresh__");
            }}
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      <div className="space-y-3 overflow-auto p-3">
        <Card className="bg-gray-50 dark:bg-slate-800 p-2">
          <div className="mb-2 flex items-center gap-2 text-[12px] font-semibold text-gray-700 dark:text-slate-200">
            <FolderOpen size={14} />
            CLOCK PROJECTS
          </div>
          <p className="mb-2 px-1 text-[10px] leading-snug text-gray-500 dark:text-slate-400">
            Fichiers système du dossier workspace/ (pas le code de l&apos;application).
          </p>

          <div className="space-y-1">
            {projectFiles.length === 0 && (
              <div className="px-2 py-2 text-[11px] text-gray-500 dark:text-slate-400">
                Aucun projet. Utilisez File → New Clock Project.
              </div>
            )}
            {projectFiles.map((file) => {
              const active = file.name === activeProjectFile || file.name === activeFileId;
              return (
                <button
                  key={file.name}
                  type="button"
                  onClick={() => handleWorkspaceFileClick(file.name)}
                  className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[12px] ${
                    active
                      ? "bg-[#17146E]/10 font-semibold text-[#17146E]"
                      : "text-gray-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-700"
                  }`}
                >
                  <FileJson2 size={14} className="shrink-0" />
                  <span className="truncate">{file.name}</span>
                </button>
              );
            })}
          </div>
        </Card>

        <Card className="bg-gray-50 dark:bg-slate-800 p-2">
          <div className="mb-2 flex items-center gap-2 text-[12px] font-semibold text-gray-700 dark:text-slate-200">
            <ChevronDown size={14} />
            OPEN EDITORS
          </div>

          <div className="space-y-1">
            {openFiles.map((file: OpenFile) => (
              <button
                key={file.id}
                type="button"
                onClick={() => handleOpenEditorClick(file.id)}
                className={`flex w-full items-center gap-2 rounded px-2 py-1 text-left text-[12px] ${
                  file.id === activeFileId
                    ? "bg-[#17146E]/10 text-[#17146E]"
                    : "text-gray-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-700"
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
