import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Card } from "../ui/Card";
import { MonacoPanel } from "../editor/MonacoPanel";
import { FlowCanvas } from "../diagram/FlowCanvas";
import { FlowToolbar } from "../diagram/FlowToolbar";
import {
  FlowNodeToolbar,
  MUX_PROFILES,
  type CreatableClockType,
  type MultiplexerProfile
} from "../diagram/FlowNodeToolbar";
import type { ClockBaseElement } from "../../types/clock";
import { useClockStore } from "../../store/clockStore";
import { useWorkspaceSync } from "../../hooks/useWorkspaceSync";
import { exportDiagramImage } from "../../utils/clockImageExport";
import { ProjectToolbar, type ExportFormat } from "./ProjectToolbar";

/**
 * Cœur de l'application : JSON Editor ↔ Projet ↔ Diagramme (workflow).
 */
export function Workspace() {
  const {
    jsonText,
    jsonError,
    flow,
    focusRange,
    activeProjectFile,
    activeProjectFolder,
    canUndo,
    canRedo,
    applyJsonToProject,
    undo,
    redo,
    importJsonText,
    exportJsonBlob
  } = useWorkspaceSync();

  const resetProject = useClockStore((s) => s.resetProject);
  const selectedNodeId = useClockStore((s) => s.selectedNodeId);
  const addNode = useClockStore((s) => s.addNode);
  const removeNode = useClockStore((s) => s.removeNode);
  const showEditor = useClockStore((s) => s.showEditor);
  const setShowEditor = useClockStore((s) => s.setShowEditor);

  const [editorWidth, setEditorWidth] = useState(460);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const workspaceRef = useRef<HTMLDivElement | null>(null);
  const resizeRef = useRef(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(editorWidth);

  useEffect(() => {
    const updateFullscreenState = () => {
      setIsFullscreen(document.fullscreenElement === workspaceRef.current);
    };
    document.addEventListener("fullscreenchange", updateFullscreenState);
    return () => document.removeEventListener("fullscreenchange", updateFullscreenState);
  }, []);

  const projectLabel = activeProjectFolder
    ? `${activeProjectFolder.replace(/^file:\/\//, "")}/${activeProjectFile || "clock.json"}`
    : activeProjectFile || "clock.json (non enregistré)";

  const handleReset = () => {
    resetProject();
    localStorage.removeItem("clock_creator_draft");
    toast.info("Projet, JSON et diagramme réinitialisés");
  };

  const handleToggleFullscreen = async () => {
    try {
      if (document.fullscreenElement === workspaceRef.current) {
        await document.exitFullscreen();
      } else {
        await workspaceRef.current?.requestFullscreen();
      }
    } catch {
      toast.error("Le mode plein écran n’est pas disponible");
    }
  };

  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".json")) {
      toast.error("Le fichier doit être un .json");
      event.target.value = "";
      return;
    }
    try {
      const text = await file.text();
      if (importJsonText(text, file.name)) {
        toast.success(`Importé : ${file.name} → JSON + diagramme`);
        setShowEditor(true);
      } else {
        toast.error("JSON invalide");
      }
    } catch {
      toast.error("Impossible de lire le fichier");
    }
    event.target.value = "";
  };

  const handleExport = async (format: ExportFormat) => {
    if (format === "json") {
      exportJsonBlob();
      toast.success("Export JSON généré");
      return;
    }
    try {
      const fileName = await exportDiagramImage(format);
      toast.success(`Export ${format.toUpperCase()} : ${fileName}`);
    } catch (error) {
      console.error("[Clock Creator] Export image échoué :", error);
      toast.error(error instanceof Error ? error.message : "Export impossible");
    }
  };

  const handleAddNode = (type: CreatableClockType, muxProfile: MultiplexerProfile = "lsco") => {
    const id = `n${Date.now()}`;
    const node: ClockBaseElement = {
      id,
      type,
      kind: type,
      label: {
        align: "top",
        text:
          type === "group"
            ? "New Group"
            : type === "multiplexer"
              ? MUX_PROFILES[muxProfile].label
              : "New Clock Block"
      },
      description: "New generated node",
      position: { x: 250, y: 200 },
      outputTargets: [],
      role: "",
      block: "",
      unit: { text: "" },
      possible_Input: []
    };

    if (type === "variableSource" || type === "editableValue") {
      node.min = 0;
      node.max = 100;
    } else if (type === "discreteSource") {
      node.oneOf = [{ const: 1 }, { const: 2 }];
      node.default = 1;
      node.value = 1;
    } else if (type === "divider" || type === "multiplier") {
      node.min = 1;
      node.max = 16;
      node.default = 1;
      node.value = 1;
    } else if (type === "multiplexer") {
      const profile = MUX_PROFILES[muxProfile];
      node.orientation = "vertical";
      node.role = "mux";
      node.description = `${profile.label} with predefined clock inputs`;
      node.possible_Input = profile.inputs.map((input, index) => ({
        label: input.label,
        description: `${input.label} (${input.sourceType})`,
        available: true,
        input_Id: `${id}_${input.label.toLowerCase().replaceAll(/[^a-z0-9]+/g, "_").replaceAll(/^_|_$/g, "")}_${index + 1}`,
        from: input.label,
        sourceType: input.sourceType,
        isLocked: false,
        sourceDisabled: false
      }));
      node.default = node.possible_Input[0].input_Id;
      node.value = node.possible_Input[0].input_Id;
      node.muxState = {
        selectedInputId: node.possible_Input[0].input_Id,
        activeInputId: node.possible_Input[0].input_Id,
        availableInputs: node.possible_Input.map((input) => input.input_Id),
        lockedInputs: [],
        disabledInputs: []
      };
    } else if (type === "fractionalValue") {
      node.base = 2;
      node.power = 0;
      node.factor = 1;
    } else if (type === "group") {
      node.size = { width: 320, height: 180 };
    }

    addNode(node);
    toast.success("Nœud ajouté → JSON + diagramme synchronisés");
  };

  const handleDeleteNode = () => {
    if (!selectedNodeId) {
      toast.error("Aucun nœud sélectionné");
      return;
    }
    removeNode(selectedNodeId);
    toast.info("Nœud supprimé");
  };

  const onResizeStart = (e: React.MouseEvent) => {
    resizeRef.current = true;
    startXRef.current = e.clientX;
    startWidthRef.current = editorWidth;

    const onMouseMove = (ev: MouseEvent) => {
      if (!resizeRef.current) return;
      const diff = ev.clientX - startXRef.current;
      setEditorWidth(Math.max(320, Math.min(820, startWidthRef.current + diff)));
    };

    const onMouseUp = () => {
      resizeRef.current = false;
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  return (
    <div ref={workspaceRef} className="flex h-full min-h-0 w-full flex-col gap-3 bg-[#f5f7fb] p-3 dark:bg-[#0d1420]">
      <ProjectToolbar
        showEditor={showEditor}
        onToggleEditor={() => setShowEditor(!showEditor)}
        onUndo={undo}
        onRedo={redo}
        canUndo={canUndo}
        canRedo={canRedo}
        onReset={handleReset}
        onImportClick={() => fileInputRef.current?.click()}
        onExport={handleExport}
        isFullscreen={isFullscreen}
        onToggleFullscreen={handleToggleFullscreen}
        projectLabel={projectLabel}
      />

      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={handleImportFile}
      />

      <div className="flex min-h-0 flex-1 gap-3 overflow-hidden">
        {showEditor && (
          <div className="min-w-0 shrink-0" style={{ width: editorWidth }}>
            <Card className="flex h-full min-w-0 flex-col overflow-hidden p-2">
              <div className="min-h-0 flex-1 overflow-hidden rounded-md border border-gray-200 dark:border-slate-700">
                <MonacoPanel
                  value={jsonText}
                  onChange={applyJsonToProject}
                  focusRange={focusRange}
                  selectedNodeId={selectedNodeId}
                />
              </div>
            </Card>
          </div>
        )}

        {showEditor && (
          <div
            onMouseDown={onResizeStart}
            className="w-1 shrink-0 cursor-col-resize rounded bg-gray-200 hover:bg-[#17146E]/40 dark:bg-slate-700"
            title="Redimensionner JSON / Diagramme"
          />
        )}

        <Card className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-3">
          <FlowToolbar />
          <FlowNodeToolbar
            onAddNode={handleAddNode}
            onDeleteNode={handleDeleteNode}
            canDelete={Boolean(selectedNodeId)}
          />

          {jsonError && (
            <div className="mb-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600 dark:border-red-900 dark:bg-red-950/40 dark:text-red-400">
              JSON invalide : {jsonError}
            </div>
          )}

          <div className="min-h-0 flex-1">
            <div className="h-full min-h-0 overflow-hidden rounded-md border border-gray-200 bg-white dark:border-slate-700 dark:bg-[#101828]">
              <FlowCanvas nodes={flow.nodes} edges={flow.edges} />
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
