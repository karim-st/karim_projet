import { create } from "zustand";
import sampleClock from "../data/STM32C5A3(M-R-V-Z)GTx_clock.json";
import type {
  ClockBaseElement,
  ClockLabel,
  ClockTreeFile,
  ClockTransition,
  ClockNodeGroup,
  ClockInputOption,
  ClockDiagnostic
} from "../types/clock";
import { propagateClockFrequencies } from "../utils/frequencyPropagation";
import { collectProjectDiagnostics } from "../utils/clockDiagnostics";
import { normalizeClockGraph } from "../utils/clockGraphNormalizer";

type OpenFile = {
  id: string;
  name: string;
  content: string;
  project?: ClockTreeFile;
};

export type PanelName =
  | "explorer"
  | "search"
  | "sourceControl"
  | "run"
  | "extensions"
  | "settings"
  | "properties"
  | "terminal";

export type BottomTab = "output" | "debug" | "terminal" | "ports";
export type LogLevel = "info" | "warn" | "error" | "debug";
export type PathHighlightMode = "path" | "endpoints" | "source";

export type CommandName =
  | "newProject"
  | "openProject"
  | "saveProject"
  | "saveAsProject"
  | "exportProject"
  | "importProject"
  | "closeTab"
  | "quitApp"
  | "undo"
  | "redo"
  | "cut"
  | "copy"
  | "paste"
  | "deleteNode"
  | "duplicateNode"
  | "renameNode"
  | "generateTemplate"
  | "generateBaseProject"
  | "loadSampleStm32"
  | "validateJson"
  | "configureRules"
  | "openAssistant"
  | "zoomIn"
  | "zoomOut"
  | "fitView"
  | "resetView"
  | "toggleGrid"
  | "toggleConnections"
  | "selectAll"
  | "clearSelection"
  | "nextItem"
  | "previousItem"
  | "searchSource"
  | "navigateOutput"
  | "navigateError"
  | "nextLink"
  | "validateProject"
  | "simulateClockTree"
  | "calculateFrequencies"
  | "checkClockPaths"
  | "openTerminal"
  | "showLogs"
  | "showErrors"
  | "showDebug"
  | "showPorts"
  | "openDocs"
  | "showVersion"
  | "showExamples"
  | "showShortcuts"
  | "showAbout";

type ClockStoreState = {
  project: ClockTreeFile;
  diagnostics: ClockDiagnostic[];
  selectedNodeId: string | null;
  selectedNode: ClockBaseElement | null;
  pathHighlight: { nodeId: string; mode: PathHighlightMode } | null;

  openFiles: OpenFile[];
  activeFileId: string | null;

  activePanel: PanelName;
  sidebarVisible: boolean;
  activeBottomTab: BottomTab;

  bottomPanelVisible: boolean;
  bottomPanelHeight: number;

  showEditor: boolean;

  lastCommand: CommandName | null;

  logs: {
    level: LogLevel;
    text: string;
    time: string;
  }[];

  showExplorer: boolean;
  showProperties: boolean;
  showTerminal: boolean;
  darkMode: boolean;
  showGrid: boolean;
  showConnections: boolean;

  setActivePanel: (panel: PanelName) => void;
  setSidebarVisible: (visible: boolean) => void;
  toggleSidebar: () => void;
  setActiveBottomTab: (tab: BottomTab) => void;
  setBottomPanelVisible: (visible: boolean) => void;
  toggleBottomPanel: () => void;
  setBottomPanelHeight: (height: number) => void;

  setShowEditor: (visible: boolean) => void;
  toggleEditor: () => void;

  setLastCommand: (cmd: CommandName) => void;
  pushLog: (msg: string, level?: LogLevel) => void;
  clearLogs: () => void;
  setDiagnostics: (diagnostics: ClockDiagnostic[]) => void;
  clearDiagnostics: () => void;

  toggleExplorer: () => void;
  toggleProperties: () => void;
  toggleTerminal: () => void;
  toggleDarkMode: () => void;
  toggleGrid: () => void;
  toggleConnections: () => void;

  setProject: (project: ClockTreeFile) => void;
  updateProjectFromJson: (jsonText: string) => void;
  resetProject: () => void;

  selectNode: (nodeId: string | null) => void;
  clearSelection: () => void;
  setPathHighlight: (
    highlight: { nodeId: string; mode: PathHighlightMode } | null
  ) => void;

  updateProjectName: (name: string) => void;
  updateNode: (nodeId: string, patch: Partial<ClockBaseElement>) => void;
  renameNode: (nodeId: string, nextNodeId: string) => boolean;
  addNode: (node: ClockBaseElement) => void;
  removeNode: (nodeId: string) => void;
  duplicateNode: (nodeId: string) => void;
  updateNodes: (nodes: ClockBaseElement[]) => void;
  updateEdges: (edges: ClockTransition[]) => void;
  createGroup: (nodeIds: string[], label?: string) => string | null;
  addNodeToGroup: (groupId: string, nodeId: string) => void;
  removeNodeFromGroup: (groupId: string, nodeId: string) => void;
  moveGroup: (groupId: string, delta: { x: number; y: number }) => void;
  updateGroup: (groupId: string, patch: Partial<Pick<ClockNodeGroup, "label" | "size">>) => void;
  deleteGroup: (groupId: string) => void;
  toggleGroupCollapsed: (groupId: string) => void;

  setMuxSelection: (nodeId: string, inputId: string, from: string) => void;

  openFile: (file: OpenFile) => void;
  closeFile: (fileId: string) => void;
  setActiveFileId: (fileId: string | null) => void;

  runCommand: (cmd: CommandName) => void;
};

function toLabel(
  label: ClockBaseElement["label"] | undefined,
  fallback: string
): ClockLabel {
  if (typeof label === "string") {
    return { align: "top", text: label };
  }

  if (label && typeof label === "object") {
    return {
      align:
        label.align === "top" ||
        label.align === "right" ||
        label.align === "left" ||
        label.align === "bottom"
          ? label.align
          : "top",
      text: typeof label.text === "string" ? label.text : fallback
    };
  }

  return { align: "top", text: fallback };
}

function toBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes"].includes(normalized)) return true;
    if (["false", "0", "no", ""].includes(normalized)) return false;
  }
  return fallback;
}

function normalizeInputOption(input: unknown): ClockInputOption {
  const value = input as Record<string, unknown> | undefined;
  return {
    label: String(value?.label ?? ""),
    description: typeof value?.description === "string" ? value.description : undefined,
    available: toBoolean(value?.available, true),
    input_Id: String(value?.input_Id ?? value?.id ?? value?.label ?? ""),
    from: String(value?.from ?? ""),
    sourceType: typeof value?.sourceType === "string" ? value.sourceType : undefined,
    isLocked: toBoolean(value?.isLocked, false),
    sourceDisabled: toBoolean(value?.sourceDisabled, false)
  };
}

function normalizeTreeMuxInputs(project: ClockTreeFile): ClockTreeFile {
  return {
    ...project,
    tree: {
      ...project.tree,
      elements: project.tree.elements.map((element) => ({
        ...element,
        isLocked: toBoolean(element.isLocked, false),
        isEnabled: toBoolean(element.isEnabled, true),
        possible_Input: Array.isArray(element.possible_Input)
          ? element.possible_Input.map(normalizeInputOption)
          : element.possible_Input
      }))
    }
  };
}

function isMuxType(type: string): boolean {
  return ["mux", "multiplexer", "multiplexor"].includes(String(type ?? "").toLowerCase());
}

function normalizeElementId(id: string): string {
  return String(id ?? "").replace(/__.*$/, "").replace(/_output$/, "").replace(/_input$/, "");
}

function inputIdFromTargetPort(nodeId: string, targetPortId?: string): string | null {
  if (!targetPortId) return null;
  const prefix = `${nodeId}__`;
  return targetPortId.startsWith(prefix) ? targetPortId.slice(prefix.length) : targetPortId;
}

function reconcileMuxInputs(
  elements: ClockBaseElement[],
  transitions: ClockTransition[]
): ClockBaseElement[] {
  const linkedSources = new Map<string, Map<string, string>>();

  for (const transition of transitions) {
    const inputId = inputIdFromTargetPort(transition.targetTaskId, transition.targetPortId);
    if (!inputId) continue;

    const targetLinks = linkedSources.get(transition.targetTaskId) ?? new Map<string, string>();
    targetLinks.set(inputId, transition.sourceTaskId);
    linkedSources.set(transition.targetTaskId, targetLinks);
  }

  return elements.map((node) => {
    if (!isMuxType(node.type) || !node.possible_Input?.length) return node;

    const sourceByInput = linkedSources.get(node.id) ?? new Map<string, string>();

    return {
      ...node,
      possible_Input: node.possible_Input.map((input) => {
        const sourceId = sourceByInput.get(input.input_Id);
        return sourceId
          ? { ...input, from: sourceId, available: true, sourceDisabled: false }
          : { ...input, from: "", sourceDisabled: false };
      })
    };
  });
}

function normalizeMuxMetadata(project: ClockTreeFile): ClockTreeFile {
  const elements = project.tree.elements.map((node) => {
    if (!isMuxType(node.type) || !node.possible_Input?.length) return node;

    const selectedInputId = node.muxState?.selectedInputId ?? node.value ?? node.default;
    const validSelection = node.possible_Input.some((input) => input.input_Id === selectedInputId);
    if (validSelection) return node;

    const firstInputId = node.possible_Input[0].input_Id;
    return {
      ...node,
      value: firstInputId,
      default: firstInputId,
      muxState: {
        ...(node.muxState ?? {}),
        selectedInputId: firstInputId,
        activeInputId: firstInputId
      }
    };
  });
  const muxes = new Map(elements.filter((node) => isMuxType(node.type)).map((node) => [node.id, node]));
  const elementsById = new Map(elements.map((node) => [node.id, node]));
  const transitions = project.tree.transitions.map((transition) => {
    const source = elementsById.get(normalizeElementId(transition.sourceTaskId));
    const target = elementsById.get(normalizeElementId(transition.targetTaskId));
    const labelPosition = transition.labelPosition ?? (
      (transition.startLabel || transition.endLabel) && source && target
        ? {
            x: source.position.x + (target.position.x - source.position.x) / 2,
            y: source.position.y + (target.position.y - source.position.y) / 2
          }
        : undefined
    );
    if (transition.targetPortId) return { ...transition, labelPosition };

    const mux = muxes.get(transition.targetTaskId);
    const input = mux?.possible_Input?.find((candidate) => candidate.from === transition.sourceTaskId);
    return mux && input
      ? { ...transition, targetPortId: `${mux.id}__${input.input_Id}`, labelPosition }
      : { ...transition, labelPosition };
  });

  return {
    ...project,
    tree: { ...project.tree, elements, transitions }
  };
}

function normalizeClockTreeFile(raw: unknown): ClockTreeFile {
  const value = raw as any;

  if (value?.tree && Array.isArray(value.tree?.elements) && Array.isArray(value.tree?.transitions)) {
    return normalizeClockGraph(normalizeMuxMetadata(normalizeTreeMuxInputs(value as ClockTreeFile)));
  }

  const edges = Array.isArray(value?.edges) ? value.edges : [];

  const elements: ClockBaseElement[] = Array.isArray(value?.nodes)
    ? value.nodes.map((node: any) => {
        const type = String(node.type ?? "editableValue");
        const isMuxNode = isMuxType(type);

        let possibleInput: ClockInputOption[] = Array.isArray(node.possible_Input)
          ? node.possible_Input.map(normalizeInputOption)
          : Array.isArray(node.data?.possible_Input)
            ? node.data.possible_Input.map(normalizeInputOption)
            : [];

        // Infer possible_Input from incoming edges if mux has none
        if (isMuxNode && possibleInput.length === 0) {
          const nodeId = String(node.id);
          possibleInput = edges
            .filter((edge: any) => String(edge.target) === nodeId)
            .map((edge: any) => ({
              label: edge.label ?? String(edge.source),
              description: undefined,
              available: true,
              input_Id: `${edge.source}_to_${nodeId}`,
              from: String(edge.source),
              isLocked: false,
              sourceDisabled: false
            }));
        }

        return {
          id: String(node.id),
          type,
          kind: String(node.type ?? "editableValue"),
          label: toLabel(node.label, String(node.id)),
          default: node.data?.defaultValue ?? node.default,
          value: node.data?.defaultValue ?? node.value,
          computedValue: node.data?.computedValue ?? node.computedValue,
          description: node.data?.description ?? node.description ?? "",
          outputTargets: node.data?.outputTargets ?? node.outputTargets ?? [],
          position: node.position ?? { x: 0, y: 0 },
          unit:
            typeof node.data?.unit === "string"
              ? { text: node.data.unit }
              : node.data?.unit ?? node.unit,
          unitOptions: node.unitOptions,
          actions: node.data?.actions ?? node.actions,
          min: node.min,
          max: node.max,
          role: node.data?.role ?? node.role,
          block: node.block,
          size: node.size,
          outputClockId: node.outputClockId,
          details: node.details,
          oneOf: node.oneOf,
          possible_Input: possibleInput,
          clocked_instance: node.clocked_instance,
          orientation: node.orientation,
          orphanLink: node.orphanLink,
          isTrustZone: node.isTrustZone,
          isLocked: node.isLocked,
          isEnabled: node.isEnabled,
          sourceDisabled: node.sourceDisabled,
          editableFields: node.editableFields,
          readonlyFields: node.readonlyFields,
          constraints: node.constraints,
          ui: node.ui
        };
      })
    : [];

  const transitions: ClockTransition[] = Array.isArray(value?.edges)
    ? value.edges.map((edge: any) => ({
        id: String(edge.id),
        sourceTaskId: String(edge.source),
        targetTaskId: String(edge.target),
        startLabel: typeof edge.label === "string" ? edge.label : undefined,
        endLabel: typeof edge.label === "string" ? edge.label : undefined,
        sourcePortId: typeof edge.sourcePortId === "string" ? edge.sourcePortId : undefined,
        targetPortId: typeof edge.targetPortId === "string" ? edge.targetPortId : undefined,
        labelPosition:
          Number.isFinite(edge.data?.labelPosition?.x) && Number.isFinite(edge.data?.labelPosition?.y)
            ? edge.data.labelPosition
            : undefined,
        transitionRoutingPoint: Array.isArray(edge.data?.routingPoints)
          ? edge.data.routingPoints
          : Array.isArray(edge.transitionRoutingPoint)
            ? edge.transitionRoutingPoint
            : undefined,
        isVirtual: false
      }))
    : [];

  return normalizeClockGraph(normalizeMuxMetadata(normalizeTreeMuxInputs({
    master_clock_version: String(value?.version ?? "1.0.0"),
    copyright: String(value?.name ?? "Clock Creator"),
    tree: {
      id: String(value?.name ?? "clock tree"),
      schema_version: String(value?.version ?? "1.0.0"),
      elements,
      transitions
    },
    version: String(value?.version ?? "1.0.0")
  })));
}

const initialProject = propagateClockFrequencies(normalizeClockTreeFile(sampleClock));
const initialDiagnostics = collectProjectDiagnostics(initialProject);

function createEmptyProject(): ClockTreeFile {
  return {
    master_clock_version: "1.0.0",
    copyright: "Clock Creator",
    version: "1.0.0",
    tree: {
      id: "clock tree",
      schema_version: "1.0.0",
      elements: [],
      transitions: []
    }
  };
}

function diagnosticsFor(project: ClockTreeFile): ClockDiagnostic[] {
  return collectProjectDiagnostics(project);
}

function refreshSelectedNode(
  project: ClockTreeFile,
  selectedNodeId: string | null
): ClockBaseElement | null {
  if (!selectedNodeId) return null;
  return project.tree.elements.find((n) => n.id === selectedNodeId) ?? null;
}

function groupBounds(nodes: ClockBaseElement[]) {
  const left = Math.min(...nodes.map((node) => node.position.x));
  const top = Math.min(...nodes.map((node) => node.position.y));
  const right = Math.max(...nodes.map((node) => node.position.x + (node.size?.width ?? 150)));
  const bottom = Math.max(...nodes.map((node) => node.position.y + (node.size?.height ?? 80)));
  const padding = 28;
  return {
    position: { x: left - padding, y: top - padding },
    size: { width: right - left + padding * 2, height: bottom - top + padding * 2 }
  };
}

const GROUP_COLOR = "#e7e7f0";

export const useClockStore = create<ClockStoreState>((set, get) => ({
  project: initialProject,
  diagnostics: initialDiagnostics,
  selectedNodeId: null,
  selectedNode: null,
  pathHighlight: null,

  openFiles: [
    {
      id: "STM32C5A3(M-R-V-Z)GTx_clock.json",
      name: "STM32C5A3(M-R-V-Z)GTx_clock.json",
      content: JSON.stringify(initialProject, null, 2),
      project: initialProject
    }
  ],
  activeFileId: "STM32C5A3(M-R-V-Z)GTx_clock.json",

  activePanel: "explorer",
  sidebarVisible: false,
  activeBottomTab: "terminal",

  bottomPanelVisible: false,
  bottomPanelHeight: 300,

  showEditor: false,

  lastCommand: null,
  logs: [],

  showExplorer: true,
  showProperties: true,
  showTerminal: true,
  darkMode: false,
  showGrid: true,
  showConnections: true,

  setActivePanel: (panel) => set({ activePanel: panel }),
  setSidebarVisible: (visible) => set({ sidebarVisible: visible }),
  toggleSidebar: () => set((state) => ({ sidebarVisible: !state.sidebarVisible })),

  setActiveBottomTab: (tab) => set({ activeBottomTab: tab }),
  setBottomPanelVisible: (visible) => set({ bottomPanelVisible: visible }),
  toggleBottomPanel: () => set((state) => ({ bottomPanelVisible: !state.bottomPanelVisible })),
  setBottomPanelHeight: (height) => set({ bottomPanelHeight: height }),

  setShowEditor: (visible) => set({ showEditor: visible }),
  toggleEditor: () => set((state) => ({ showEditor: !state.showEditor })),

  setLastCommand: (cmd) => set({ lastCommand: cmd }),
  pushLog: (msg, level = "info") =>
    set((state) => ({
      logs: [...state.logs, { level, text: msg, time: new Date().toLocaleTimeString() }]
    })),
  clearLogs: () => set({ logs: [] }),
  setDiagnostics: (diagnostics) => set({ diagnostics }),
  clearDiagnostics: () => set({ diagnostics: [] }),

  toggleExplorer: () => set((state) => ({ showExplorer: !state.showExplorer })),
  toggleProperties: () => set((state) => ({ showProperties: !state.showProperties })),
  toggleTerminal: () => set((state) => ({ showTerminal: !state.showTerminal })),
  toggleDarkMode: () => set((state) => ({ darkMode: !state.darkMode })),
  toggleGrid: () => set((state) => ({ showGrid: !state.showGrid })),
  toggleConnections: () => set((state) => ({ showConnections: !state.showConnections })),

  setProject: (project) => {
    const normalized = propagateClockFrequencies(normalizeClockTreeFile(project));
    set({
      project: normalized,
      diagnostics: diagnosticsFor(normalized),
      selectedNode: refreshSelectedNode(normalized, get().selectedNodeId)
    });
  },

  updateProjectFromJson: (jsonText) => {
    try {
      const parsed = JSON.parse(jsonText);
      const normalized = propagateClockFrequencies(normalizeClockTreeFile(parsed));

      set((state) => ({
        project: normalized,
        diagnostics: diagnosticsFor(normalized),
        selectedNode: refreshSelectedNode(normalized, state.selectedNodeId)
      }));
    } catch {
      // ignore invalid JSON
    }
  },

  resetProject: () => {
    const project = createEmptyProject();
    set({
      project,
      diagnostics: diagnosticsFor(project),
      selectedNodeId: null,
      selectedNode: null,
      pathHighlight: null
    });
  },

  selectNode: (nodeId) =>
    set((state) => {
      const selectedNode = state.project.tree.elements.find((n) => n.id === nodeId) ?? null;

      return {
        selectedNodeId: nodeId,
        selectedNode,
        activePanel: "properties",
        sidebarVisible: true
      };
    }),

  clearSelection: () => set({ selectedNodeId: null, selectedNode: null }),
  setPathHighlight: (pathHighlight) => set({ pathHighlight }),

  updateProjectName: (name) =>
    set((state) => ({
      project: {
        ...state.project,
        copyright: name
      }
    })),

  updateNode: (nodeId, patch) =>
    set((state) => {
      const currentNode = state.project.tree.elements.find((node) => node.id === nodeId);
      const nextInputIds = new Set(
        patch.possible_Input?.map((input) => input.input_Id) ??
          currentNode?.possible_Input?.map((input) => input.input_Id) ??
          []
      );
      const removedInputs = (currentNode?.possible_Input ?? []).filter(
        (input) => !nextInputIds.has(input.input_Id)
      );
      const updatedElements = state.project.tree.elements.map((node) => {
        if (node.id !== nodeId) return node;

        const nextLabel =
          patch.label !== undefined ? toLabel(patch.label, node.id) : node.label;

        return {
          ...node,
          ...patch,
          label: nextLabel
        };
      });

      const updatedProject = propagateClockFrequencies({
        ...state.project,
        tree: {
          ...state.project.tree,
          elements: updatedElements,
          transitions: state.project.tree.transitions.filter((transition) => {
            if (transition.targetTaskId !== nodeId || removedInputs.length === 0) return true;

            return !removedInputs.some((input) => {
              const targetPortId = String(transition.targetPortId ?? "");
              const targetsRemovedHandle =
                targetPortId === input.input_Id ||
                targetPortId === `${nodeId}__${input.input_Id}`;
              const comesFromRemovedSource =
                String(transition.sourceTaskId).replace(/_output$/, "") ===
                String(input.from).replace(/_output$/, "");
              return targetsRemovedHandle || comesFromRemovedSource;
            });
          })
        }
      });

      return {
        project: updatedProject,
        diagnostics: diagnosticsFor(updatedProject),
        selectedNode:
          state.selectedNodeId === nodeId
            ? updatedProject.tree.elements.find((n) => n.id === nodeId) ?? null
            : state.selectedNode
      };
    }),

  renameNode: (nodeId, nextNodeId) => {
    const normalizedNodeId = nextNodeId.trim();
    if (!normalizedNodeId || normalizedNodeId === nodeId) return normalizedNodeId === nodeId;

    const state = get();
    if (state.project.tree.elements.some((node) => node.id === normalizedNodeId)) return false;

    const remapReference = (reference: string | undefined) => {
      if (!reference) return reference;
      if (reference === nodeId) return normalizedNodeId;
      if (reference === `${nodeId}_output`) return `${normalizedNodeId}_output`;
      if (reference === `${nodeId}_input`) return `${normalizedNodeId}_input`;
      if (reference.startsWith(`${nodeId}__`)) return `${normalizedNodeId}${reference.slice(nodeId.length)}`;
      return reference;
    };

    const elements = state.project.tree.elements.map((node) => ({
      ...node,
      id: node.id === nodeId ? normalizedNodeId : node.id,
      possible_Input: node.possible_Input?.map((input) => ({
        ...input,
        from: remapReference(input.from) ?? ""
      }))
    }));
    const transitions = state.project.tree.transitions.map((transition) => ({
      ...transition,
      sourceTaskId: remapReference(transition.sourceTaskId) ?? transition.sourceTaskId,
      targetTaskId: remapReference(transition.targetTaskId) ?? transition.targetTaskId,
      sourcePortId: remapReference(transition.sourcePortId),
      targetPortId: remapReference(transition.targetPortId)
    }));
    const project = propagateClockFrequencies({
      ...state.project,
      tree: { ...state.project.tree, elements, transitions }
    });

    set({
      project,
      diagnostics: diagnosticsFor(project),
      selectedNodeId: state.selectedNodeId === nodeId ? normalizedNodeId : state.selectedNodeId,
      selectedNode: refreshSelectedNode(
        project,
        state.selectedNodeId === nodeId ? normalizedNodeId : state.selectedNodeId
      ),
      pathHighlight:
        state.pathHighlight?.nodeId === nodeId
          ? { ...state.pathHighlight, nodeId: normalizedNodeId }
          : state.pathHighlight
    });
    return true;
  },

  addNode: (node) =>
    set((state) => {
      const exists = state.project.tree.elements.some((candidate) =>
        candidate.id === node.id ||
        (node.logicalId !== undefined && candidate.logicalId === node.logicalId)
      );
      if (exists) return state;

      const updatedProject = propagateClockFrequencies(normalizeClockGraph({
        ...state.project,
        tree: {
          ...state.project.tree,
          elements: [...state.project.tree.elements, node]
        }
      }));

      return {
        project: updatedProject,
        diagnostics: diagnosticsFor(updatedProject)
      };
    }),

  removeNode: (nodeId) =>
    set((state) => {
      const updatedProject = propagateClockFrequencies({
        ...state.project,
        tree: {
          ...state.project.tree,
          elements: state.project.tree.elements.filter((node) => node.id !== nodeId),
          groups: (state.project.tree.groups ?? []).map((group) => ({
            ...group,
            nodeIds: group.nodeIds.filter((id) => id !== nodeId)
          })),
          transitions: state.project.tree.transitions.filter(
            (edge) =>
              normalizeElementId(edge.sourceTaskId) !== nodeId &&
              normalizeElementId(edge.targetTaskId) !== nodeId
          )
        }
      });

      const isSelected = state.selectedNodeId === nodeId;

      return {
        project: updatedProject,
        diagnostics: diagnosticsFor(updatedProject),
        selectedNodeId: isSelected ? null : state.selectedNodeId,
        selectedNode: isSelected ? null : refreshSelectedNode(updatedProject, state.selectedNodeId)
      };
    }),

  duplicateNode: (nodeId) =>
    set((state) => {
      const node = state.project.tree.elements.find((n) => n.id === nodeId);
      if (!node) return state;

      const duplicated: ClockBaseElement = {
        ...node,
        id: `${node.id}_copy_${Date.now()}`,
        position: {
          x: node.position.x + 30,
          y: node.position.y + 30
        }
      };

      const updatedProject = propagateClockFrequencies({
        ...state.project,
        tree: {
          ...state.project.tree,
          elements: [...state.project.tree.elements, duplicated]
        }
      });

      return {
        project: updatedProject,
        diagnostics: diagnosticsFor(updatedProject)
      };
    }),

  updateNodes: (nodes) =>
    set((state) => {
      const updatedProject = propagateClockFrequencies(normalizeClockGraph({
        ...state.project,
        tree: {
          ...state.project.tree,
          elements: nodes
        }
      }));

      return {
        project: updatedProject,
        diagnostics: diagnosticsFor(updatedProject),
        selectedNode: refreshSelectedNode(updatedProject, state.selectedNodeId)
      };
    }),

  updateEdges: (edges) =>
    set((state) => {
      const elements = reconcileMuxInputs(state.project.tree.elements, edges);
      const updatedProject = propagateClockFrequencies(normalizeClockGraph({
        ...state.project,
        tree: {
          ...state.project.tree,
          elements,
          transitions: edges
        }
      }));

      return {
        project: updatedProject,
        diagnostics: diagnosticsFor(updatedProject)
      };
    }),

  createGroup: (nodeIds, label = "Groupe") => {
    const state = get();
    const alreadyGrouped = new Set((state.project.tree.groups ?? []).flatMap((group) => group.nodeIds));
    const members = state.project.tree.elements.filter((node) => nodeIds.includes(node.id) && !alreadyGrouped.has(node.id));
    if (members.length < 2) return null;

    const id = `group-${Date.now()}`;
    const bounds = groupBounds(members);
    const group: ClockNodeGroup = {
      id,
      label,
      color: GROUP_COLOR,
      nodeIds: members.map((node) => node.id),
      ...bounds,
      collapsed: false
    };
    const project = propagateClockFrequencies(normalizeClockGraph({
      ...state.project,
      tree: { ...state.project.tree, groups: [...(state.project.tree.groups ?? []), group] }
    }));
    set({ project, diagnostics: diagnosticsFor(project) });
    return id;
  },

  addNodeToGroup: (groupId, nodeId) =>
    set((state) => {
      if (!state.project.tree.elements.some((node) => node.id === nodeId)) return state;
      const project = normalizeClockGraph({
        ...state.project,
        tree: {
          ...state.project.tree,
          groups: (state.project.tree.groups ?? []).map((group) =>
            group.id === groupId ? { ...group, nodeIds: [...group.nodeIds, nodeId] } : group
          )
        }
      });
      return { project, diagnostics: diagnosticsFor(project) };
    }),

  removeNodeFromGroup: (groupId, nodeId) =>
    set((state) => {
      const project = normalizeClockGraph({
        ...state.project,
        tree: {
          ...state.project.tree,
          groups: (state.project.tree.groups ?? []).map((group) =>
            group.id === groupId ? { ...group, nodeIds: group.nodeIds.filter((id) => id !== nodeId) } : group
          )
        }
      });
      return { project, diagnostics: diagnosticsFor(project) };
    }),

  moveGroup: (groupId, delta) =>
    set((state) => {
      const group = state.project.tree.groups?.find((candidate) => candidate.id === groupId);
      if (!group) return state;
      const memberIds = new Set(group.nodeIds);
      const project = propagateClockFrequencies({
        ...state.project,
        tree: {
          ...state.project.tree,
          elements: state.project.tree.elements.map((node) => memberIds.has(node.id)
            ? { ...node, position: { x: node.position.x + delta.x, y: node.position.y + delta.y } }
            : node),
          groups: (state.project.tree.groups ?? []).map((candidate) => candidate.id === groupId
            ? { ...candidate, position: { x: candidate.position.x + delta.x, y: candidate.position.y + delta.y } }
            : candidate)
        }
      });
      return { project, diagnostics: diagnosticsFor(project) };
    }),

  updateGroup: (groupId, patch) =>
    set((state) => {
      const project = {
        ...state.project,
        tree: {
          ...state.project.tree,
          groups: (state.project.tree.groups ?? []).map((group) => group.id === groupId
            ? {
                ...group,
                ...(patch.label !== undefined ? { label: patch.label.trim() || "Groupe" } : {}),
                ...(patch.size ? {
                  size: {
                    width: Math.max(180, Math.round(patch.size.width)),
                    height: Math.max(120, Math.round(patch.size.height))
                  }
                } : {})
              }
            : group)
        }
      };
      return { project, diagnostics: diagnosticsFor(project) };
    }),

  deleteGroup: (groupId) =>
    set((state) => {
      const project = {
        ...state.project,
        tree: { ...state.project.tree, groups: (state.project.tree.groups ?? []).filter((group) => group.id !== groupId) }
      };
      return { project, diagnostics: diagnosticsFor(project) };
    }),

  toggleGroupCollapsed: (groupId) =>
    set((state) => {
      const project = {
        ...state.project,
        tree: {
          ...state.project.tree,
          groups: (state.project.tree.groups ?? []).map((group) =>
            group.id === groupId ? { ...group, collapsed: !group.collapsed } : group
          )
        }
      };
      return { project, diagnostics: diagnosticsFor(project) };
    }),

  setMuxSelection: (nodeId, inputId, from) =>
    set((state) => {
      const updatedElements = state.project.tree.elements.map((node) => {
        if (node.id !== nodeId) return node;

        const selectedInput = node.possible_Input?.find((input) => input.input_Id === inputId);
        if (!selectedInput) return node;

        return {
          ...node,
          value: inputId,
          default: inputId,
          muxState: {
            ...(node.muxState ?? {}),
            selectedInputId: inputId,
            activeInputId: inputId,
            availableInputs: (node.possible_Input ?? [])
              .filter((input) => input.available !== false)
              .map((input) => input.input_Id),
            lockedInputs: (node.possible_Input ?? [])
              .filter((input) => input.isLocked)
              .map((input) => input.input_Id),
            disabledInputs: (node.possible_Input ?? [])
              .filter((input) => input.sourceDisabled)
              .map((input) => input.input_Id)
          },
          possible_Input: node.possible_Input?.map((input) =>
            input.input_Id === inputId && from ? { ...input, from } : input
          )
        };
      });

      const updatedProject = propagateClockFrequencies({
        ...state.project,
        tree: {
          ...state.project.tree,
          elements: updatedElements
        }
      });

      return {
        project: updatedProject,
        diagnostics: diagnosticsFor(updatedProject),
        selectedNode: refreshSelectedNode(updatedProject, state.selectedNodeId),
        logs: [
          ...state.logs,
          {
            level: "info",
            text: `Mux ${nodeId} selected input ${inputId}`,
            time: new Date().toLocaleTimeString()
          }
        ]
      };
    }),

  openFile: (file) =>
    set((state) => ({
      openFiles: state.openFiles.some((f) => f.id === file.id)
        ? state.openFiles
        : [...state.openFiles, file],
      activeFileId: file.id
    })),

  closeFile: (fileId) =>
    set((state) => {
      const nextFiles = state.openFiles.filter((f) => f.id !== fileId);
      return {
        openFiles: nextFiles,
        activeFileId:
          state.activeFileId === fileId ? nextFiles[0]?.id ?? null : state.activeFileId
      };
    }),

  setActiveFileId: (fileId) => set({ activeFileId: fileId }),

  runCommand: (cmd) => {
    set({ lastCommand: cmd });

    switch (cmd) {
      case "newProject":
        get().pushLog("New project command executed", "info");
        break;
      case "openProject":
        get().pushLog("Open project command executed", "info");
        break;
      case "saveProject":
        get().pushLog("Save project command executed", "info");
        break;
      case "exportProject":
        get().pushLog("Export project command executed", "info");
        break;
      case "validateProject":
        get().pushLog("Validation started", "debug");
        break;
      default:
        break;
    }
  }
}));