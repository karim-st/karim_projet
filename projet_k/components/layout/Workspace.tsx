import { useEffect, useMemo, useRef, useState } from "react";
import { Code2, Maximize2, Minimize2, Moon, Redo2, Sun, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { MonacoPanel } from "../editor/MonacoPanel";
import { FlowCanvas } from "../diagram/FlowCanvas";
import { FlowToolbar } from "../diagram/FlowToolbar";
import {
  FlowNodeToolbar,
  MUX_PROFILES,
  type CreatableClockType,
  type MultiplexerProfile
} from "../diagram/FlowNodeToolbar";
import { parseJsonSafe } from "../../utils/jsonParser";
import { clockTreeToFlow } from "../../utils/clockTreeMapper";
import { findNodeJsonRange } from "../../utils/jsonSearch";
import type { ClockBaseElement, ClockTreeFile } from "../../types/clock";
import { useClockStore } from "../../store/clockStore";

export function Workspace() {
  const project = useClockStore((s) => s.project);
  const setProject = useClockStore((s) => s.setProject);
  const updateProjectFromJson = useClockStore((s) => s.updateProjectFromJson);
  const resetProject = useClockStore((s) => s.resetProject);
  const selectedNodeId = useClockStore((s) => s.selectedNodeId);
  const addNode = useClockStore((s) => s.addNode);
  const removeNode = useClockStore((s) => s.removeNode);
  const showEditor = useClockStore((s) => s.showEditor);
  const setShowEditor = useClockStore((s) => s.setShowEditor);
  const darkMode = useClockStore((s) => s.darkMode);
  const toggleDarkMode = useClockStore((s) => s.toggleDarkMode);

  const [jsonText, setJsonText] = useState(() => JSON.stringify(project, null, 2));
  const [editorWidth, setEditorWidth] = useState(460);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [, setHistoryVersion] = useState(0);
  const [focusRange, setFocusRange] = useState<{ startLine: number; endLine: number } | null>(
    null
  );

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const workspaceRef = useRef<HTMLDivElement | null>(null);
  const resizeRef = useRef(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(editorWidth);
  const historyRef = useRef({
    past: [] as string[],
    current: JSON.stringify(project),
    future: [] as string[]
  });

  useEffect(() => {
    const snapshot = JSON.stringify(project);
    const history = historyRef.current;

    if (snapshot !== history.current) {
      history.past.push(history.current);
      history.current = snapshot;
      history.future = [];
      setHistoryVersion((version) => version + 1);
    }

    setJsonText(JSON.stringify(project, null, 2));
  }, [project]);

  useEffect(() => {
    const updateFullscreenState = () => {
      setIsFullscreen(document.fullscreenElement === workspaceRef.current);
    };

    document.addEventListener("fullscreenchange", updateFullscreenState);
    return () => document.removeEventListener("fullscreenchange", updateFullscreenState);
  }, []);

  const parsed = useMemo(() => parseJsonSafe<ClockTreeFile>(jsonText), [jsonText]);

  const flow = useMemo(() => clockTreeToFlow(project), [project]);

  useEffect(() => {
    if (!selectedNodeId) {
      setFocusRange(null);
      return;
    }

    const range = findNodeJsonRange(jsonText, selectedNodeId);
    setFocusRange((currentRange) =>
      currentRange?.startLine === range?.startLine && currentRange?.endLine === range?.endLine
        ? currentRange
        : range
    );
  }, [selectedNodeId, jsonText]);

  const handleReset = () => {
    resetProject();
    localStorage.removeItem("clock_creator_draft");
    setJsonText(JSON.stringify(useClockStore.getState().project, null, 2));
    toast.info("Code et schéma réinitialisés");
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

  const restoreHistorySnapshot = (snapshot: string) => {
    const restoredProject = JSON.parse(snapshot) as ClockTreeFile;
    setProject(restoredProject);
    setJsonText(JSON.stringify(restoredProject, null, 2));
    localStorage.setItem("clock_creator_draft", JSON.stringify(restoredProject, null, 2));
  };

  const handleUndo = () => {
    const history = historyRef.current;
    const previousSnapshot = history.past.pop();
    if (!previousSnapshot) return;

    history.future.push(history.current);
    history.current = previousSnapshot;
    restoreHistorySnapshot(previousSnapshot);
    setHistoryVersion((version) => version + 1);
  };

  const handleRedo = () => {
    const history = historyRef.current;
    const nextSnapshot = history.future.pop();
    if (!nextSnapshot) return;

    history.past.push(history.current);
    history.current = nextSnapshot;
    restoreHistorySnapshot(nextSnapshot);
    setHistoryVersion((version) => version + 1);
  };

  const handleExport = () => {
    const data = JSON.stringify(project, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = "clock_tree.json";
    link.click();

    URL.revokeObjectURL(url);
    toast.success("Export JSON généré");
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".json")) {
      toast.error("Le fichier sélectionné doit avoir l’extension .json");
      event.target.value = "";
      return;
    }

    try {
      const text = await file.text();
      setJsonText(text);

      const parsedFile = parseJsonSafe<ClockTreeFile>(text);
      if (parsedFile.data) {
        setProject(parsedFile.data);
        toast.success("Fichier importé avec succès");
        setShowEditor(true);
      } else {
        toast.error("Fichier JSON invalide");
      }
    } catch {
      toast.error("Impossible de lire le fichier sélectionné");
    }

    event.target.value = "";
  };

  const handleAutoSave = (value: string) => {
    setJsonText(value);
    localStorage.setItem("clock_creator_draft", value);

    // applique immédiatement le JSON au schéma et aux propriétés
    updateProjectFromJson(value);
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
    toast.success("Clock component added");
  };

  const handleDeleteNode = () => {
    if (!selectedNodeId) {
      toast.error("No selected node");
      return;
    }

    removeNode(selectedNodeId);
    toast.info("Node deleted");
  };

  const onResizeStart = (e: React.MouseEvent) => {
    resizeRef.current = true;
    startXRef.current = e.clientX;
    startWidthRef.current = editorWidth;

    const onMouseMove = (ev: MouseEvent) => {
      if (!resizeRef.current) return;

      const diff = ev.clientX - startXRef.current;
      const nextWidth = Math.max(320, Math.min(820, startWidthRef.current + diff));
      setEditorWidth(nextWidth);
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
    <div ref={workspaceRef} className="flex h-full min-h-0 w-full flex-col gap-3 bg-[#f5f7fb] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button
          variant="secondary"
          onClick={() => setShowEditor(!showEditor)}
          title={showEditor ? "Masquer l'IDE" : "Afficher l'IDE"}
          aria-label={showEditor ? "Masquer l'IDE" : "Afficher l'IDE"}
        >
          <Code2 size={16} />
          {showEditor ? "Hide IDE" : "Show IDE"}
        </Button>
        <div className="flex items-center gap-1">
          <Button
            variant="secondary"
            onClick={handleUndo}
            disabled={historyRef.current.past.length === 0}
            className="px-2.5 py-2"
            title="Undo"
            aria-label="Revenir à l'état précédent"
          >
            <Undo2 size={16} />
          </Button>
          <Button
            variant="secondary"
            onClick={handleRedo}
            disabled={historyRef.current.future.length === 0}
            className="px-2.5 py-2"
            title="Redo"
            aria-label="Revenir à l'état suivant"
          >
            <Redo2 size={16} />
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" onClick={handleReset}>
          Reset
        </Button>
        <Button
          variant="secondary"
          onClick={handleToggleFullscreen}
          className="px-2.5 py-2"
          title={isFullscreen ? "Quitter le plein écran" : "Plein écran"}
          aria-label={isFullscreen ? "Quitter le plein écran" : "Afficher l'espace de travail en plein écran"}
        >
          {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
        </Button>
        <Button variant="secondary" onClick={handleImportClick}>
          Import
        </Button>
        <Button variant="secondary" onClick={handleExport}>
          Export
        </Button>
        <Button
          variant="secondary"
          onClick={toggleDarkMode}
          className="px-2.5 py-2"
          title={darkMode ? "Activer le mode clair" : "Activer le mode sombre"}
          aria-label={darkMode ? "Activer le mode clair" : "Activer le mode sombre"}
        >
          {darkMode ? <Sun size={16} /> : <Moon size={16} />}
        </Button>
        </div>
      </div>

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
            <div className="flex items-center justify-between text-xs font-semibold text-gray-700">
              <span>Editor</span>
              <button
                onClick={() => setShowEditor(false)}
                className="rounded px-2 py-1 text-[11px] text-gray-500 hover:bg-gray-100 hover:text-gray-800"
              >
                x
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-hidden rounded-md border border-gray-200">
              <MonacoPanel
                value={jsonText}
                onChange={handleAutoSave}
                focusRange={focusRange}
              />
            </div>
            </Card>
          </div>
        )}

        {showEditor && (
          <div
            onMouseDown={onResizeStart}
            className="w-1 shrink-0 cursor-col-resize rounded bg-gray-200 hover:bg-[#17146E]/40"
            title="Resize Monaco / Diagram"
          />
        )}

        <Card className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-3">
        <FlowToolbar />
        <FlowNodeToolbar
          onAddNode={handleAddNode}
          onDeleteNode={handleDeleteNode}
          canDelete={Boolean(selectedNodeId)}
        />

        {parsed.error && (
          <div className="mb-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
            {parsed.error}
          </div>
        )}

        <div className="min-h-0 flex-1">
          <div className="h-full min-h-0 overflow-hidden rounded-md border border-gray-200 bg-white">
            <FlowCanvas nodes={flow.nodes} edges={flow.edges} />
          </div>
        </div>
        </Card>
      </div>
    </div>
  );
}