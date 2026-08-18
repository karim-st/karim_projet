import { useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  Code2,
  FileImage,
  FileJson2,
  FileType2,
  Maximize2,
  Minimize2,
  Redo2,
  Undo2,
  Download,
  Upload
} from "lucide-react";
import { Button } from "../ui/Button";
import type { DiagramExportFormat } from "../../utils/clockImageExport";

export type ExportFormat = "json" | DiagramExportFormat;

type ExportOption = {
  format: ExportFormat;
  label: string;
  icon: typeof Download;
};

const EXPORT_OPTIONS: ExportOption[] = [
  { format: "json", label: "Export Clock JSON", icon: FileJson2 },
  { format: "png", label: "Export Diagram PNG", icon: FileImage },
  { format: "jpg", label: "Export Diagram JPG", icon: FileImage },
  { format: "svg", label: "Export Diagram SVG", icon: FileType2 }
];

type ProjectToolbarProps = {
  showEditor: boolean;
  onToggleEditor: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onReset: () => void;
  onImportClick: () => void;
  onExport: (format: ExportFormat) => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  projectLabel: string;
};

export function ProjectToolbar({
  showEditor,
  onToggleEditor,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onReset,
  onImportClick,
  onExport,
  isFullscreen,
  onToggleFullscreen,
  projectLabel
}: ProjectToolbarProps) {
  const [exportOpen, setExportOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!exportOpen) {
      return;
    }
    const handleClickOutside = (event: MouseEvent) => {
      if (!exportMenuRef.current?.contains(event.target as Node)) {
        setExportOpen(false);
      }
    };
    window.addEventListener("mousedown", handleClickOutside);
    return () => window.removeEventListener("mousedown", handleClickOutside);
  }, [exportOpen]);

  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" onClick={onToggleEditor}>
          <Code2 size={16} />
          {showEditor ? "Hide IDE" : "Show IDE"}
        </Button>

        <Button
          variant="secondary"
          onClick={onUndo}
          disabled={!canUndo}
          className="px-2.5 py-2"
          title="Undo"
        >
          <Undo2 size={16} />
        </Button>
        <Button
          variant="secondary"
          onClick={onRedo}
          disabled={!canRedo}
          className="px-2.5 py-2"
          title="Redo"
        >
          <Redo2 size={16} />
        </Button>
      </div>

      <div className="max-w-[280px] truncate rounded-md bg-white px-2 py-1 text-[11px] text-gray-600 ring-1 ring-gray-200 dark:bg-[#1e293b] dark:text-slate-300 dark:ring-slate-600">
        {projectLabel}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" onClick={onReset}>
          Reset
        </Button>
        <Button
          variant="secondary"
          onClick={onToggleFullscreen}
          className="px-2.5 py-2"
          title={isFullscreen ? "Quitter le plein écran" : "Plein écran"}
        >
          {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
        </Button>
        <Button variant="secondary" onClick={onImportClick} title="Importer un JSON">
          <Upload size={16} />
          Import
        </Button>
        <div className="relative" ref={exportMenuRef}>
          <Button
            variant="secondary"
            onClick={() => setExportOpen((open) => !open)}
            title="Exporter le projet (JSON ou image du diagramme)"
            aria-expanded={exportOpen}
            aria-haspopup="menu"
          >
            <Download size={16} />
            Export
            <ChevronDown size={14} />
          </Button>
          {exportOpen && (
            <div className="absolute right-0 top-full z-50 mt-1 w-52 overflow-hidden rounded-md border border-gray-200 bg-white py-1 text-xs text-gray-700 shadow-lg dark:border-slate-600 dark:bg-[#1e293b] dark:text-slate-200" role="menu">
              {EXPORT_OPTIONS.map((option) => {
                const Icon = option.icon;
                return (
                  <button
                    key={option.format}
                    type="button"
                    role="menuitem"
                    className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-slate-700"
                    onClick={() => {
                      setExportOpen(false);
                      onExport(option.format);
                    }}
                  >
                    <Icon size={14} />
                    {option.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}