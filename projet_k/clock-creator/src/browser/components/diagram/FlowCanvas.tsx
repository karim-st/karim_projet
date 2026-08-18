import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  Clipboard,
  Circle,
  Copy,
  Grid2X2,
  LayoutGrid,
  Minus,
  PanelTop,
  Ruler,
  RectangleHorizontal,
  Scissors,
  Search,
  Shapes,
  Square,
  Type,
  Columns3,
  Trash2,
  X
} from "lucide-react";
import ReactFlow, {
  Background,
  BackgroundVariant,
  Controls,
  MarkerType,
  MiniMap,
  ReactFlowProvider,
  useReactFlow,
  useNodesState,
  type Connection,
  type Edge,
  type Node
} from "reactflow";
import "reactflow/dist/style.css";
import { useClockStore } from "../../store/clockStore";
import type { ClockBaseElement, ClockTransition, ClockTransitionLineStyle } from "../../types/clock";
import { ClockBlockNode } from "./nodes/ClockBlockNode";
import { MultiplexerNode } from "./nodes/MultiplexerNode";
import { GroupNode } from "./nodes/GroupNode";
import { DividerNode } from "./nodes/DividerNode";
import { AnnotationNode } from "./nodes/AnnotationNode";
import { RoutingEdge } from "./edges/RoutingEdge";
import { ConnectionPreview } from "./edges/ConnectionPreview";
import { normalizePortId } from "../../utils/clockLayout";

type FlowCanvasProps = {
  nodes: Node[];
  edges: Edge[];
};

type NodeHelperLines = {
  x?: number;
  y?: number;
};

const nodeTypes = {
  variableSource: ClockBlockNode,
  editableValue: ClockBlockNode,
  divider: DividerNode,
  annotation: AnnotationNode,
  multiplexer: MultiplexerNode,
  group: GroupNode
};

const edgeTypes = {
  routingEdge: RoutingEdge
};

const multiSelectionKeyCode = ["Meta", "Control"];
const NODE_ALIGNMENT_DISTANCE = 8;

type DiagramBackground = "lines" | "cross" | "grid" | "graphPaper" | "isometric" | "zones" | "plain";

const backgroundOptions: Array<{
  id: DiagramBackground;
  label: string;
  icon: typeof Grid2X2;
  variant?: BackgroundVariant;
  gap?: number;
  size?: number;
  className?: string;
}> = [
  { id: "lines", label: "Lignes", icon: Minus, variant: BackgroundVariant.Lines, gap: 22, size: 1 },
  { id: "cross", label: "Croix", icon: PanelTop, variant: BackgroundVariant.Cross, gap: 22, size: 5 },
  { id: "grid", label: "Carreaux", icon: Grid2X2, variant: BackgroundVariant.Lines, gap: 44, size: 1 },
  { id: "graphPaper", label: "Papier millimétré", icon: Ruler, className: "clock-background-graph-paper" },
  { id: "isometric", label: "Isométrique", icon: Shapes, className: "clock-background-isometric" },
  { id: "zones", label: "Zones fonctionnelles", icon: Columns3, className: "clock-background-zones" },
  { id: "plain", label: "Vide", icon: LayoutGrid }
];

type AnnotationType = "annotationText" | "annotationRectangle" | "annotationSquare" | "annotationCircle";

function edgeStyle(lineStyle: ClockTransitionLineStyle = "normal") {
  if (lineStyle === "dashed") {
    return { stroke: "#7b8798", strokeWidth: 1.5, strokeDasharray: "8 5", strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  }
  if (lineStyle === "bold") {
    return { stroke: "#7b8798", strokeWidth: 3, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  }
  return {
    stroke: "#7b8798",
    strokeWidth: 1.5,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const
  };
}

function marker() {
  return {
    type: MarkerType.ArrowClosed,
    width: 10,
    height: 10,
    color: "#7b8798"
  } as const;
}

function findNodeHelperLines(draggedNode: Node, nodes: Node[]): NodeHelperLines {
  const width = draggedNode.width ?? 150;
  const height = draggedNode.height ?? 80;
  const xAnchors = [draggedNode.position.x, draggedNode.position.x + width / 2, draggedNode.position.x + width];
  const yAnchors = [draggedNode.position.y, draggedNode.position.y + height / 2, draggedNode.position.y + height];
  let x: number | undefined;
  let y: number | undefined;

  for (const node of nodes) {
    if (node.id === draggedNode.id || node.type === "group") continue;
    const nodeWidth = node.width ?? 150;
    const nodeHeight = node.height ?? 80;
    const candidateX = [node.position.x, node.position.x + nodeWidth / 2, node.position.x + nodeWidth];
    const candidateY = [node.position.y, node.position.y + nodeHeight / 2, node.position.y + nodeHeight];

    for (const draggedAnchor of xAnchors) {
      const match = candidateX.find((anchor) => Math.abs(anchor - draggedAnchor) <= NODE_ALIGNMENT_DISTANCE);
      if (match !== undefined) x = match;
    }
    for (const draggedAnchor of yAnchors) {
      const match = candidateY.find((anchor) => Math.abs(anchor - draggedAnchor) <= NODE_ALIGNMENT_DISTANCE);
      if (match !== undefined) y = match;
    }
  }

  return { x, y };
}

function connectionError(
  connection: Connection,
  nodes: Node[],
  transitions: ClockTransition[],
  ignoredEdgeId?: string
): string | null {
  if (!connection.source || !connection.target) return "A connection needs both a source and a target.";
  if (connection.source === connection.target) return "A clock node cannot be connected to itself.";

  const sourceNode = nodes.find((node) => node.id === connection.source);
  const targetNode = nodes.find((node) => node.id === connection.target);
  if (!sourceNode || !targetNode) return "The selected source or target node no longer exists.";
  if (sourceNode.type === "group" || targetNode.type === "group") return "Groups cannot be connected to clock signals.";
  if (targetNode.data?.mode === "source") return "A clock source cannot receive an incoming connection.";

  const targetPortId = connection.targetHandle ?? "input";
  const duplicated = transitions.some(
    (transition) =>
      transition.id !== ignoredEdgeId &&
      transition.sourceTaskId === connection.source &&
      transition.targetTaskId === connection.target &&
      (transition.targetPortId ?? "input") === targetPortId
  );
  if (duplicated) {
    return "This connection already exists between the same source and target.";
  }

  if (targetNode.type === "multiplexer") {
    const inputs = targetNode.data?.possible_Input ?? [];
    const inputId = String(connection.targetHandle ?? "").replace(`${targetNode.id}__`, "");
    if (!connection.targetHandle || !inputs.some((input: { input_Id: string }) => input.input_Id === inputId)) {
      return "Choose a valid multiplexer input before creating this connection.";
    }
  } else if ((connection.targetHandle ?? "input") !== "input") {
    return "The target node does not expose the requested input port.";
  }

  const adjacency = new Map<string, string[]>();
  for (const transition of transitions) {
    if (transition.id === ignoredEdgeId) continue;
    const source = normalizePortId(transition.sourceTaskId);
    const target = normalizePortId(transition.targetTaskId);
    adjacency.set(source, [...(adjacency.get(source) ?? []), target]);
  }
  const queue = [connection.target];
  const visited = new Set<string>();
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === connection.source) return "This connection would create a clock-tree cycle.";
    if (visited.has(current)) continue;
    visited.add(current);
    queue.push(...(adjacency.get(current) ?? []));
  }

  return null;
}

function collectPath(
  startNodeId: string,
  transitions: ClockTransition[],
  direction: "upstream" | "downstream"
) {
  const nodeIds = new Set([startNodeId]);
  const edgeIds = new Set<string>();
  const queue = [startNodeId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const transition of transitions) {
      const sourceId = normalizePortId(transition.sourceTaskId);
      const targetId = normalizePortId(transition.targetTaskId);
      const matches = direction === "upstream"
        ? targetId === current
        : sourceId === current;
      if (!matches) continue;

      edgeIds.add(transition.id);
      const next = direction === "upstream"
        ? sourceId
        : targetId;
      if (!nodeIds.has(next)) {
        nodeIds.add(next);
        queue.push(next);
      }
    }
  }

  return { nodeIds, edgeIds };
}

const defaultEdgeOptions = {
  type: "step",
  style: edgeStyle(),
  markerEnd: marker()
};

function FlowCanvasContent({ nodes, edges }: FlowCanvasProps) {
  const selectNode = useClockStore((state) => state.selectNode);
  const updateNode = useClockStore((state) => state.updateNode);
  const updateNodes = useClockStore((state) => state.updateNodes);
  const addNode = useClockStore((state) => state.addNode);
  const removeNode = useClockStore((state) => state.removeNode);
  const createGroup = useClockStore((state) => state.createGroup);
  const addNodeToGroup = useClockStore((state) => state.addNodeToGroup);
  const moveGroup = useClockStore((state) => state.moveGroup);
  const updateGroup = useClockStore((state) => state.updateGroup);
  const deleteGroup = useClockStore((state) => state.deleteGroup);
  const toggleGroupCollapsed = useClockStore((state) => state.toggleGroupCollapsed);
  const transitions = useClockStore((state) => state.project.tree.transitions);
  const updateEdges = useClockStore((state) => state.updateEdges);
  const pushLog = useClockStore((state) => state.pushLog);
  const pathHighlight = useClockStore((state) => state.pathHighlight);
  const setPathHighlight = useClockStore((state) => state.setPathHighlight);
  const setShowEditor = useClockStore((state) => state.setShowEditor);
  const darkMode = useClockStore((state) => state.darkMode);
  const selectedNode = useClockStore((state) => state.selectedNode);
  const projectTreeId = useClockStore((state) => state.project.tree.id);
  const activeProjectFile = useClockStore((state) => state.activeProjectFile);
  const { getViewport, screenToFlowPosition, fitView } = useReactFlow();
  const nodeClickTimerRef = useRef<number | null>(null);
  const lastNodePointerRef = useRef<{ nodeId: string; time: number } | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [nodeHelperLines, setNodeHelperLines] = useState<NodeHelperLines>({});
  const [annotationFontSize, setAnnotationFontSize] = useState(16);
  const [backgroundType, setBackgroundType] = useState<DiagramBackground>("lines");
  const [elementSearch, setElementSearch] = useState("");
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    nodeId?: string;
  } | null>(null);
  const clipboardRef = useRef<ClockBaseElement[]>([]);

  const [flowNodes, setFlowNodes, onNodesChange] = useNodesState(nodes);
  const lastFittedIdentityRef = useRef<string | null>(null);
  const fitAttemptTimeoutRef = useRef<number | null>(null);
  const selectedBackground = backgroundOptions.find((option) => option.id === backgroundType) ?? backgroundOptions[0];
  const selectedTransition = transitions.find((transition) => transition.id === selectedEdgeId);
  const selectedShape = selectedNode && ["annotationrectangle", "annotationsquare", "annotationcircle"].includes(String(selectedNode.type).toLowerCase())
    ? selectedNode
    : null;
  const selectedTextAnnotation = selectedNode && String(selectedNode.type).toLowerCase() === "annotationtext"
    ? selectedNode
    : null;
  const viewport = getViewport();
  const highlighted = useMemo(() => {
    if (!pathHighlight) return null;

    const upstream = collectPath(pathHighlight.nodeId, transitions, "upstream");
    const downstream = collectPath(pathHighlight.nodeId, transitions, "downstream");

    if (pathHighlight.mode === "source") return upstream;
    if (pathHighlight.mode === "endpoints") {
      const endpointIds = new Set<string>();
      for (const nodeId of downstream.nodeIds) {
        const hasOutgoing = transitions.some(
          (edge) => normalizePortId(edge.sourceTaskId) === nodeId
        );
        if (!hasOutgoing) endpointIds.add(nodeId);
      }
      endpointIds.add(pathHighlight.nodeId);
      return { nodeIds: endpointIds, edgeIds: downstream.edgeIds };
    }

    return {
      nodeIds: new Set([...upstream.nodeIds, ...downstream.nodeIds]),
      edgeIds: new Set([...upstream.edgeIds, ...downstream.edgeIds])
    };
  }, [pathHighlight, transitions]);

  const searchMatches = useMemo(() => {
    const query = elementSearch.trim().toLowerCase();
    if (!query) return null;

    const matches = new Set<string>();
    for (const node of flowNodes) {
      const data = (node.data ?? {}) as {
        label?: string | { text?: string };
        description?: string;
        possible_Input?: { label: string }[];
      };
      const label = typeof data.label === "string" ? data.label : data.label?.text ?? "";
      const haystack = [label, node.id, data.description ?? ""]
        .concat((data.possible_Input ?? []).map((input) => input.label))
        .join(" ")
        .toLowerCase();
      if (haystack.includes(query)) matches.add(node.id);
    }
    return matches;
  }, [elementSearch, flowNodes]);

  const isSearching = searchMatches !== null;
  const activeSet = isSearching ? searchMatches : highlighted?.nodeIds ?? null;

  const renderedNodes = useMemo(
    () => flowNodes.map((node) => {
      const isSelected = selectedNodeIds.includes(node.id);
      const isGroup = node.type === "group";
      const active = activeSet ? activeSet.has(node.id) : true;
      const searchRing = isSearching && active && !isGroup;
      return {
        ...node,
        zIndex: isGroup ? -2 : node.zIndex,
        draggable: !isReadOnly && node.draggable,
        connectable: !isReadOnly && node.connectable,
        data: { ...node.data, readOnly: isReadOnly },
        style: {
          ...node.style,
          outline: isSelected && !isGroup
            ? "2px solid #087fdb"
            : searchRing
              ? "2px solid #38bdf8"
              : undefined,
          outlineOffset: isSelected && !isGroup || searchRing ? "2px" : undefined,
          opacity: activeSet ? (active ? 1 : 0.28) : 1,
          filter: isSearching
            ? searchRing
              ? "drop-shadow(0 0 3px rgba(56, 189, 248, 0.85))"
              : undefined
            : highlighted
              ? active
                ? "drop-shadow(0 0 3px rgba(8, 127, 219, 0.85))"
                : "grayscale(0.7)"
              : undefined
        }
      };
    }),
    [flowNodes, highlighted, isReadOnly, selectedNodeIds, activeSet, isSearching]
  );
  const renderedEdges = useMemo(
    () => {
      const sourcesByNode = new Map<string, { edgeId: string; index: number }[]>();
      for (const edge of edges) {
        const source = normalizePortId(String(edge.source));
        sourcesByNode.set(source, [...(sourcesByNode.get(source) ?? []), { edgeId: String(edge.id), index: 0 }]);
      }
      for (const group of sourcesByNode.values()) {
        group.forEach((entry, index) => { entry.index = index; });
      }
      const fanOutByEdge = new Map<string, { branchOffset: number; showJunction: boolean }>();
      for (const group of sourcesByNode.values()) {
        if (group.length < 2) continue;
        const total = group.length;
        for (const entry of group) {
          fanOutByEdge.set(entry.edgeId, {
            branchOffset: (entry.index - (total - 1) / 2) * 3,
            showJunction: true
          });
        }
      }

      return edges.map((edge) => {
        const lineStyle = ((edge.data as { lineStyle?: ClockTransitionLineStyle } | undefined)?.lineStyle ?? "normal");
        const isHighlighted = highlighted?.edgeIds.has(edge.id) ?? false;
        const hasError = Boolean((edge.data as { hasError?: boolean } | undefined)?.hasError);
        const baseLineColor = darkMode ? "#f1f5f9" : "#7b8798";
        const inactiveLineColor = darkMode ? "#64748b" : "#c4cad2";
        const searchInactive = isSearching
          ? !activeSet!.has(String(edge.source)) || !activeSet!.has(String(edge.target))
          : false;
        const fanOut = fanOutByEdge.get(String(edge.id));
        return {
        ...edge,
        selected: edge.id === selectedEdgeId,
        zIndex: edge.id === selectedEdgeId ? 20 : isHighlighted ? 10 : 0,
        label: edge.label,
        type: edge.type ?? "step",
        style: hasError
          ? { ...edgeStyle(lineStyle), stroke: "#ef4444", strokeWidth: lineStyle === "bold" ? 5 : 3.5 }
          : edge.id === selectedEdgeId
          ? { ...edgeStyle(lineStyle), stroke: "#38bdf8", strokeWidth: lineStyle === "bold" ? 5 : 3.5 }
          : isHighlighted
          ? { ...edgeStyle(lineStyle), stroke: "#38bdf8", strokeWidth: lineStyle === "bold" ? 5 : 3.5 }
          : searchInactive
            ? { stroke: inactiveLineColor, strokeWidth: 1 }
            : isSearching
              ? { ...edgeStyle(lineStyle), stroke: "#38bdf8", strokeWidth: 1.5 }
              : highlighted
                ? { stroke: inactiveLineColor, strokeWidth: 1 }
                : { ...edgeStyle(lineStyle), stroke: baseLineColor },
        markerEnd: {
          ...marker(),
          color: hasError ? "#ef4444" : darkMode ? "#ffffff" : edge.id === selectedEdgeId || isHighlighted || isSearching ? "#087fdb" : "#7b8798"
        },
        data: {
          ...(edge as any).data,
          routingPoints: (edge as any).data?.routingPoints ?? [],
          lineStyle,
          isHighlighted,
          hasError,
          darkMode,
          readOnly: isReadOnly,
          showControlPoints: false,
          fanOut
        }
      }; });
    },
    [darkMode, edges, highlighted, isReadOnly, selectedEdgeId, activeSet, isSearching]
  );

  useEffect(() => {
    setFlowNodes(nodes);
  }, [nodes, setFlowNodes]);

  /**
   * Ajuste automatiquement le viewport quand un autre projet/fichier est
   * chargé (ouverture, import) : le fitView initial de React Flow ne
   * s'exécute qu'au montage, donc sans cela les nœuds du nouveau projet
   * peuvent rester hors cadre et le schéma paraître vide.
   */
  useEffect(() => {
    const identity = `${activeProjectFile ?? 'clock.json'}::${projectTreeId}`;
    if (identity === lastFittedIdentityRef.current) {
      return;
    }
    const tryFit = (attempt: number) => {
      if (fitView({ padding: 0.14, maxZoom: 1 })) {
        lastFittedIdentityRef.current = identity;
        fitAttemptTimeoutRef.current = null;
        return;
      }
      // Les dimensions des nœuds arrivent de façon asynchrone (ResizeObserver)
      if (attempt >= 12) {
        fitAttemptTimeoutRef.current = null;
        return;
      }
      fitAttemptTimeoutRef.current = window.setTimeout(() => tryFit(attempt + 1), 90);
    };
    tryFit(0);
    return () => {
      if (fitAttemptTimeoutRef.current !== null) {
        window.clearTimeout(fitAttemptTimeoutRef.current);
        fitAttemptTimeoutRef.current = null;
      }
    };
  }, [activeProjectFile, projectTreeId, fitView]);

  useEffect(() => {
    if (selectedTextAnnotation) {
      setAnnotationFontSize(selectedTextAnnotation.ui?.fontSize ?? 16);
    }
  }, [selectedTextAnnotation]);

  useEffect(() => {
    const handleEdgeSelect = (event: Event) => setSelectedEdgeId((event as CustomEvent<string>).detail);
    window.addEventListener("clock-edge-select", handleEdgeSelect);
    return () => window.removeEventListener("clock-edge-select", handleEdgeSelect);
  }, []);

  useEffect(() => {
    const setReadOnly = (event: Event) => {
      const next = (event as CustomEvent<boolean>).detail;
      setIsReadOnly(next);
    };
    window.addEventListener("clock-read-only-change", setReadOnly);
    return () => {
      window.removeEventListener("clock-read-only-change", setReadOnly);
    };
  }, []);

  useEffect(() => {
    const handleGroupAction = (event: Event) => {
      const { action, groupId, label, size } = (event as CustomEvent<{
        action: "delete" | "toggle" | "rename" | "resize";
        groupId: string;
        label?: string;
        size?: { width: number; height: number };
      }>).detail;
      if (isReadOnly) return;
      if (action === "delete") deleteGroup(groupId);
      else if (action === "toggle") toggleGroupCollapsed(groupId);
      else if (action === "rename" && label !== undefined) updateGroup(groupId, { label });
      else if (action === "resize" && size) updateGroup(groupId, { size });
    };
    window.addEventListener("clock-group-action", handleGroupAction);
    return () => window.removeEventListener("clock-group-action", handleGroupAction);
  }, [deleteGroup, isReadOnly, toggleGroupCollapsed, updateGroup]);

  useEffect(() => () => {
    if (nodeClickTimerRef.current !== null) {
      window.clearTimeout(nodeClickTimerRef.current);
    }
  }, []);

  const saveConnection = (connection: Connection, existingEdgeId?: string) => {
    const error = connectionError(connection, nodes, transitions, existingEdgeId);
    if (error) {
      pushLog(error, "warn");
      return;
    }

    if (!connection.source || !connection.target) return;

    const targetPortId = connection.targetHandle ?? "input";
    const previousTransition = existingEdgeId
      ? transitions.find((transition) => transition.id === existingEdgeId)
      : undefined;
    const sourceNode = nodes.find((node) => node.id === connection.source);
    const targetNode = nodes.find((node) => node.id === connection.target);
    const retainedTransitions = transitions.filter(
      (transition) =>
        transition.id !== existingEdgeId &&
        (transition.targetTaskId !== connection.target ||
          (transition.targetPortId ?? "input") !== targetPortId)
    );

    const transition: ClockTransition = {
      id: existingEdgeId ?? `edge_${connection.source}_${connection.target}_${Date.now()}`,
      sourceTaskId: connection.source,
      targetTaskId: connection.target,
      sourcePortId: connection.sourceHandle ?? undefined,
      targetPortId,
      labelPosition: previousTransition?.labelPosition ?? (
        sourceNode && targetNode
          ? {
              x: sourceNode.position.x + (targetNode.position.x - sourceNode.position.x) / 2,
              y: sourceNode.position.y + (targetNode.position.y - sourceNode.position.y) / 2
            }
          : undefined
      ),
      isVirtual: false
    };

    updateEdges([...retainedTransitions, transition]);
  };

  const handleConnect = (connection: Connection) => saveConnection(connection);

  const handleEdgeUpdate = (oldEdge: Edge, connection: Connection) => {
    saveConnection(connection, oldEdge.id);
  };

  const handleEdgesDelete = (deletedEdges: Edge[]) => {
    const deletedIds = new Set(deletedEdges.map((edge) => edge.id));
    if (selectedEdgeId && deletedIds.has(selectedEdgeId)) {
      setSelectedEdgeId(null);
      window.dispatchEvent(new CustomEvent("clock-edge-select", { detail: null }));
    }
    updateEdges(transitions.filter((transition) => !deletedIds.has(transition.id)));
  };

  const setEdgeLineStyle = (lineStyle: ClockTransitionLineStyle) => {
    if (isReadOnly) return;
    if (!selectedEdgeId) return;
    updateEdges(transitions.map((transition) =>
      transition.id === selectedEdgeId ? { ...transition, lineStyle } : transition
    ));
  };

  const updateSelectedShapeStyle = (patch: NonNullable<ClockBaseElement["ui"]>) => {
    if (isReadOnly) return;
    if (!selectedShape) return;
    updateNode(selectedShape.id, { ui: { ...selectedShape.ui, ...patch } });
  };

  const setAnnotationTextSize = (fontSize: number) => {
    if (isReadOnly) return;
    const nextSize = Math.min(72, Math.max(8, fontSize || 16));
    setAnnotationFontSize(nextSize);
    if (selectedTextAnnotation) {
      updateNode(selectedTextAnnotation.id, {
        ui: { ...selectedTextAnnotation.ui, fontSize: nextSize }
      });
    }
  };

  const addAnnotation = (type: AnnotationType) => {
    if (isReadOnly) return;
    const project = useClockStore.getState().project;
    const annotations = project.tree.elements.filter((element) => String(element.type).startsWith("annotation"));
    const offset = annotations.length * 24;
    const isText = type === "annotationText";
    const isCircle = type === "annotationCircle";
    const isSquare = type === "annotationSquare";
    const node: ClockBaseElement = {
      id: `annotation_${Date.now()}`,
      type,
      kind: type,
      label: { text: isText ? "Texte" : "", align: "top" },
      description: "Graph annotation",
      position: { x: -300 + offset, y: 176 + offset },
      size: isText
        ? { width: 180, height: 38 }
        : isCircle || isSquare
          ? { width: 96, height: 96 }
          : { width: 180, height: 96 },
      isEnabled: true,
      ui: isText ? { fontSize: annotationFontSize, color: "#263548" } : { variant: "annotation" }
    };
    addNode(node);
    setSelectedNodeIds([node.id]);
    selectNode(node.id);
  };

  const handleEdgeDoubleClick = (event: React.MouseEvent, edge: Edge) => {
    if (isReadOnly) return;
    event.preventDefault();
    event.stopPropagation();
    const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
    const existingPoints = ((edge.data as { routingPoints?: ClockTransition["transitionRoutingPoint"] } | undefined)?.routingPoints ?? []);
    const pointIndex = existingPoints.length === 0
      ? 0
      : Math.max(...existingPoints.map((point) => point.pointIndex)) + 1;

    updateEdges(transitions.map((transition) =>
      transition.id === edge.id
        ? {
            ...transition,
            transitionRoutingPoint: [
              ...(transition.transitionRoutingPoint ?? []),
              { kind: "linear", x: position.x, y: position.y, pointIndex }
            ]
          }
        : transition
    ));
    setSelectedEdgeId(edge.id);
  };

  const selectedElements = () => {
    const selectedIds = new Set(selectedNodeIds);
    return useClockStore.getState().project.tree.elements.filter((node) => selectedIds.has(node.id));
  };

  const cloneElements = (elements: ClockBaseElement[]) =>
    JSON.parse(JSON.stringify(elements)) as ClockBaseElement[];

  const removeSelectedNodes = () => {
    if (isReadOnly) return;
    const selectedIds = new Set(selectedNodeIds);
    selectedIds.forEach((nodeId) => removeNode(nodeId));
    setSelectedNodeIds([]);
  };

  const groupSelectedNodes = () => {
    if (isReadOnly) return;
    const componentIds = flowNodes
      .filter((node) => selectedNodeIds.includes(node.id) && node.type !== "group")
      .map((node) => node.id);
    const groupId = createGroup(componentIds);
    if (!groupId) return;
    setSelectedNodeIds([]);
    setFlowNodes((currentNodes) => currentNodes.map((node) => ({ ...node, selected: false })));
  };

  useEffect(() => {
    window.addEventListener("clock-group-request", groupSelectedNodes);
    return () => window.removeEventListener("clock-group-request", groupSelectedNodes);
  }, [groupSelectedNodes]);

  const pasteClipboard = () => {
    if (isReadOnly) return;
    if (clipboardRef.current.length === 0) return;

    const timestamp = Date.now();
    const pasted = cloneElements(clipboardRef.current).map((node, index) => ({
      ...node,
      id: `${node.id}_copy_${timestamp}_${index + 1}`,
      position: { x: node.position.x + 32, y: node.position.y + 32 }
    }));
    const project = useClockStore.getState().project;
    updateNodes([...project.tree.elements, ...pasted]);
    setSelectedNodeIds(pasted.map((node) => node.id));
  };

  const alignSelectedNodes = (axis: "horizontal" | "vertical") => {
    if (isReadOnly) return;
    const elements = selectedElements();
    if (elements.length < 2) return;

    const target = Math.round(
      elements.reduce((total, node) => total + (axis === "horizontal" ? node.position.y : node.position.x), 0) /
        elements.length
    );
    const selectedIds = new Set(elements.map((node) => node.id));
    const project = useClockStore.getState().project;
    updateNodes(
      project.tree.elements.map((node) =>
        selectedIds.has(node.id)
          ? {
              ...node,
              position:
                axis === "horizontal"
                  ? { ...node.position, y: target }
                  : { ...node.position, x: target }
            }
          : node
      )
    );
  };

  const selectContextNode = (nodeId: string) => {
    const nextSelectedIds = selectedNodeIds.includes(nodeId) ? selectedNodeIds : [nodeId];
    setSelectedNodeIds(nextSelectedIds);
    setFlowNodes((currentNodes) =>
      currentNodes.map((node) => ({ ...node, selected: nextSelectedIds.includes(node.id) }))
    );
    selectNode(nodeId);
    return nextSelectedIds;
  };

  const setSelectedNodes = (nodeIds: string[]) => {
    setSelectedNodeIds(nodeIds);
    setFlowNodes((currentNodes) =>
      currentNodes.map((node) => ({ ...node, selected: nodeIds.includes(node.id) }))
    );
  };

  useEffect(() => {
    const handleKeyboardShortcut = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const active = document.activeElement as HTMLElement | null;
      const inMonaco =
        Boolean(target?.closest?.(".monaco-editor")) ||
        Boolean(active?.closest?.(".monaco-editor")) ||
        Boolean(target?.closest?.(".clock-monaco-host")) ||
        Boolean(active?.closest?.(".clock-monaco-host")) ||
        Boolean(target?.closest?.('[data-monaco-ide="true"]')) ||
        Boolean(active?.closest?.('[data-monaco-ide="true"]')) ||
        // Monaco place le caret dans un textarea interne
        Boolean(active?.classList?.contains("inputarea"));

      if (
        inMonaco ||
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target?.isContentEditable ||
        active instanceof HTMLInputElement ||
        active instanceof HTMLTextAreaElement ||
        active?.isContentEditable
      ) {
        // Laisser Monaco / champs texte gérer tous les raccourcis IDE
        return;
      }

      if (isReadOnly) return;

      if (!event.ctrlKey && !event.metaKey) return;

      const key = event.key.toLowerCase();
      if (key === "a") {
        event.preventDefault();
        setSelectedNodes(useClockStore.getState().project.tree.elements.map((node) => node.id));
      } else if (key === "c" && selectedNodeIds.length > 0) {
        event.preventDefault();
        clipboardRef.current = cloneElements(selectedElements());
      } else if (key === "x" && selectedNodeIds.length > 0) {
        event.preventDefault();
        clipboardRef.current = cloneElements(selectedElements());
        removeSelectedNodes();
      } else if (key === "v" && clipboardRef.current.length > 0) {
        event.preventDefault();
        pasteClipboard();
      }
    };

    // bubble only — ne pas capturer avant Monaco
    window.addEventListener("keydown", handleKeyboardShortcut, false);
    return () => window.removeEventListener("keydown", handleKeyboardShortcut, false);
  }, [isReadOnly, selectedNodeIds]);

  return (
    <div
      className={`relative h-full w-full overflow-hidden ${darkMode ? "bg-[#1b222c]" : "bg-[#f5f6f8]"} ${selectedBackground.className ?? ""}`}
      aria-label={`Clock diagram: ${nodes.length} components, ${edges.length} connections`}
      onPointerDownCapture={(event) => {
        const target = event.target as HTMLElement;
        if (target.closest(".nodrag.nopan")) return;

        const flowNode = target.closest<HTMLElement>(".react-flow__node");
        const nodeId = flowNode?.dataset.id;
        if (!nodeId) return;

        const now = Date.now();
        const previous = lastNodePointerRef.current;
        lastNodePointerRef.current = { nodeId, time: now };
        if (!previous || previous.nodeId !== nodeId || now - previous.time > 350) return;

        if (nodeClickTimerRef.current !== null) {
          window.clearTimeout(nodeClickTimerRef.current);
          nodeClickTimerRef.current = null;
        }
        selectNode(nodeId);
        setShowEditor(true);
      }}
    >
      <ReactFlow
        nodeOrigin={[0, 0]}
        nodes={renderedNodes}
        edges={renderedEdges}
        fitView
        fitViewOptions={{ padding: 0.14, minZoom: 0.3, maxZoom: 1 }}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        elevateNodesOnSelect={false}
        onNodesChange={onNodesChange}
        onNodeDrag={(_, node) => {
          if (!isReadOnly) setNodeHelperLines(findNodeHelperLines(node, flowNodes));
        }}
        onNodeDragStop={(_, node) => {
          if (isReadOnly) return;
          setNodeHelperLines({});
          if (node.type === "group") {
            const groupId = (node.data as { groupId?: string }).groupId;
            const group = useClockStore.getState().project.tree.groups?.find((candidate) => candidate.id === groupId);
            if (group && groupId) {
              moveGroup(groupId, { x: node.position.x - group.position.x, y: node.position.y - group.position.y });
            }
          } else {
            updateNode(node.id, { position: node.position });
            const groups = useClockStore.getState().project.tree.groups ?? [];
            const nodeWidth = node.width ?? (Number(node.style?.width) || 150);
            const nodeHeight = node.height ?? (Number(node.style?.height) || 80);
            const nodeCenter = {
              x: node.position.x + nodeWidth / 2,
              y: node.position.y + nodeHeight / 2
            };
            const targetGroup = groups.find((group) =>
              !group.nodeIds.includes(node.id) &&
              nodeCenter.x >= group.position.x &&
              nodeCenter.x <= group.position.x + group.size.width &&
              nodeCenter.y >= group.position.y &&
              nodeCenter.y <= group.position.y + group.size.height
            );
            if (targetGroup && window.confirm(`Ajouter ce composant au groupe "${targetGroup.label}" ?`)) {
              addNodeToGroup(targetGroup.id, node.id);
            }
          }
        }}
        onNodesDelete={(deletedNodes) => {
          if (isReadOnly) return;
          deletedNodes.forEach((node) => removeNode(node.id));
        }}
        onNodeContextMenu={(event, node) => {
          event.preventDefault();
          selectContextNode(node.id);
          setContextMenu({ x: event.clientX, y: event.clientY, nodeId: node.id });
        }}
        onPaneContextMenu={(event) => {
          event.preventDefault();
          setSelectedNodes([]);
          selectNode(null);
          setContextMenu({ x: event.clientX, y: event.clientY });
        }}
        multiSelectionKeyCode={multiSelectionKeyCode}
        onConnect={isReadOnly ? undefined : handleConnect}
        onEdgeUpdate={isReadOnly ? undefined : handleEdgeUpdate}
        onEdgesDelete={isReadOnly ? undefined : handleEdgesDelete}
        onEdgeClick={(_, edge) => {
          setSelectedEdgeId(edge.id);
          selectNode(null);
          window.dispatchEvent(new CustomEvent("clock-edge-select", { detail: edge.id }));
        }}
        onEdgeDoubleClick={handleEdgeDoubleClick}
        edgesFocusable
        nodesDraggable={!isReadOnly}
        nodesConnectable={!isReadOnly}
        edgesUpdatable={!isReadOnly}
        deleteKeyCode={["Backspace", "Delete"]}
        panActivationKeyCode={null}
        minZoom={0.3}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
        defaultEdgeOptions={defaultEdgeOptions}
        connectionLineStyle={edgeStyle()}
        connectionLineComponent={ConnectionPreview}
        onNodeClick={(event, node) => {
          const isMultiSelect = event.ctrlKey || event.metaKey;
          const nextSelectedIds = isMultiSelect
            ? selectedNodeIds.includes(node.id)
              ? selectedNodeIds.filter((nodeId) => nodeId !== node.id)
              : [...selectedNodeIds, node.id]
            : [node.id];
          setSelectedNodes(nextSelectedIds);
          setSelectedEdgeId(null);
          window.dispatchEvent(new CustomEvent("clock-edge-select", { detail: null }));

          if (nodeClickTimerRef.current !== null) {
            window.clearTimeout(nodeClickTimerRef.current);
          }
          nodeClickTimerRef.current = window.setTimeout(() => {
            selectNode(node.id);
            nodeClickTimerRef.current = null;
          }, 220);
        }}
        onPaneClick={() => {
          if (nodeClickTimerRef.current !== null) {
            window.clearTimeout(nodeClickTimerRef.current);
            nodeClickTimerRef.current = null;
          }
          selectNode(null);
          setPathHighlight(null);
          setSelectedEdgeId(null);
          window.dispatchEvent(new CustomEvent("clock-edge-select", { detail: null }));
          setSelectedNodes([]);
          setContextMenu(null);
        }}
      >
        {(nodeHelperLines.x !== undefined || nodeHelperLines.y !== undefined) && (
          <svg className="pointer-events-none absolute inset-0 z-10 h-full w-full" aria-hidden="true">
            {nodeHelperLines.x !== undefined && (
              <line
                x1={viewport.x + nodeHelperLines.x * viewport.zoom}
                x2={viewport.x + nodeHelperLines.x * viewport.zoom}
                y1={0}
                y2="100%"
                stroke="#087fdb"
                strokeWidth={1}
                strokeDasharray="5 4"
              />
            )}
            {nodeHelperLines.y !== undefined && (
              <line
                x1={0}
                x2="100%"
                y1={viewport.y + nodeHelperLines.y * viewport.zoom}
                y2={viewport.y + nodeHelperLines.y * viewport.zoom}
                stroke="#087fdb"
                strokeWidth={1}
                strokeDasharray="5 4"
              />
            )}
          </svg>
        )}
        <div className={`absolute left-1/2 top-3 z-20 flex -translate-x-1/2 overflow-hidden rounded-md border shadow-md ${darkMode ? "border-slate-500 bg-[#202b38]" : "border-gray-300 bg-white"}`} role="toolbar" aria-label="Style du lien">
            {([
              { id: "normal", label: "Ligne normale", icon: Minus },
              { id: "dashed", label: "Ligne découpée", icon: Scissors },
              { id: "bold", label: "Ligne grasse", icon: Ruler }
            ] as const).map(({ id, label, icon: Icon }) => {
              const isActive = (selectedTransition?.lineStyle ?? "normal") === id;
              return (
                <button
                  key={id}
                  type="button"
                  title={label}
                  aria-label={label}
                  aria-pressed={isActive}
                  onClick={() => setEdgeLineStyle(id)}
                  disabled={!selectedTransition || isReadOnly}
                  className={`flex h-8 w-8 items-center justify-center border-r border-gray-200 dark:border-slate-600 last:border-r-0 disabled:cursor-not-allowed disabled:opacity-40 ${
                    isActive && selectedTransition
                      ? "bg-[#087fdb] text-white"
                      : darkMode
                        ? "text-white hover:bg-slate-700"
                        : "text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700"
                  }`}
                >
                  <Icon size={15} strokeWidth={id === "bold" ? 3 : 2} aria-hidden="true" />
                </button>
              );
            })}
        </div>
        <div className={`absolute left-3 top-3 z-20 flex items-center overflow-hidden rounded-md border shadow-md ${darkMode ? "border-slate-500 bg-[#202b38]" : "border-gray-300 bg-white"}`} role="toolbar" aria-label="Annotations du schéma">
          <button type="button" disabled={isReadOnly} title="Ajouter un texte" aria-label="Ajouter un texte" onClick={() => addAnnotation("annotationText")} className="flex h-8 w-8 items-center justify-center border-r border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40">
            <Type size={15} aria-hidden="true" />
          </button>
          <input disabled={isReadOnly} type="number" min="8" max="72" value={annotationFontSize} onChange={(event) => setAnnotationTextSize(Number(event.target.value))} className="h-8 w-12 border-r border-gray-200 dark:border-slate-600 bg-white px-1 text-[10px] text-gray-700 dark:text-slate-100 outline-none disabled:cursor-not-allowed disabled:opacity-40 dark:bg-[#141d2b]" aria-label="Taille du texte" title="Taille du texte" />
          <button type="button" disabled={isReadOnly} title="Ajouter un rectangle" aria-label="Ajouter un rectangle" onClick={() => addAnnotation("annotationRectangle")} className="flex h-8 w-8 items-center justify-center border-r border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40">
            <RectangleHorizontal size={16} aria-hidden="true" />
          </button>
          <button type="button" disabled={isReadOnly} title="Ajouter un carré" aria-label="Ajouter un carré" onClick={() => addAnnotation("annotationSquare")} className="flex h-8 w-8 items-center justify-center border-r border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40">
            <Square size={15} aria-hidden="true" />
          </button>
          <button type="button" disabled={isReadOnly} title="Ajouter un cercle" aria-label="Ajouter un cercle" onClick={() => addAnnotation("annotationCircle")} className="flex h-8 w-8 items-center justify-center text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40">
            <Circle size={15} aria-hidden="true" />
          </button>
        </div>
        {selectedShape && (
          <div className={`absolute left-3 top-14 z-20 flex items-center gap-2 rounded-md border px-2 py-1 shadow-md ${darkMode ? "border-slate-500 bg-[#202b38] text-slate-100" : "border-gray-300 bg-white text-gray-700"}`} role="toolbar" aria-label="Style de la forme">
            <label className="flex items-center gap-1 text-[10px] font-medium">
              Remplissage
              <input disabled={isReadOnly} type="color" value={selectedShape.ui?.fillColor ?? "#dbeafe"} onChange={(event) => updateSelectedShapeStyle({ fillColor: event.target.value })} className="h-6 w-7 cursor-pointer border-0 bg-transparent p-0 disabled:cursor-not-allowed disabled:opacity-40" aria-label="Couleur de remplissage" />
            </label>
            <label className="flex items-center gap-1 text-[10px] font-medium">
              Contour
              <input disabled={isReadOnly} type="color" value={selectedShape.ui?.outlineColor ?? "#2563eb"} onChange={(event) => updateSelectedShapeStyle({ outlineColor: event.target.value })} className="h-6 w-7 cursor-pointer border-0 bg-transparent p-0 disabled:cursor-not-allowed disabled:opacity-40" aria-label="Couleur du contour" />
            </label>
          </div>
        )}
        <div className={`absolute right-3 top-3 z-20 flex overflow-hidden rounded-md border shadow-md ${darkMode ? "border-slate-500 bg-[#202b38]" : "border-gray-300 bg-white"}`} role="toolbar" aria-label="Fond du schéma">
          {backgroundOptions.map((option) => {
            const Icon = option.icon;
            const isActive = option.id === backgroundType;
            return (
              <button
                key={option.id}
                type="button"
                title={option.label}
                aria-label={`Fond : ${option.label}`}
                aria-pressed={isActive}
                onClick={() => setBackgroundType(option.id)}
                className={`flex h-8 w-8 items-center justify-center border-r border-gray-200 dark:border-slate-600 last:border-r-0 ${isActive ? "bg-[#17146E] text-white" : "text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700"}`}
              >
                <Icon size={15} aria-hidden="true" />
              </button>
            );
          })}
        </div>
        {selectedBackground.variant && (
          <Background
            variant={selectedBackground.variant}
            gap={selectedBackground.gap}
            size={selectedBackground.size}
            color={darkMode ? "#364251" : "#e3e7ee"}
          />
        )}
        <MiniMap
          pannable
          zoomable
          nodeColor={(node) => node.type === "annotation" ? "#94a3b8" : "#66758a"}
          maskColor={darkMode ? "rgba(19, 29, 42, 0.7)" : "rgba(237, 241, 246, 0.72)"}
          className={darkMode
            ? "!rounded-md !border !border-slate-500 !bg-[#202b38] !shadow-md"
            : "!rounded-md !border !border-gray-300 !bg-white !shadow-md"}
        />
        <Controls showInteractive={false} />
      </ReactFlow>
      {contextMenu && (
        <div
          className="fixed z-50 w-44 overflow-hidden rounded-md border border-gray-200 bg-white py-1 text-xs text-gray-700 shadow-lg dark:border-slate-600 dark:bg-[#1e293b] dark:text-slate-200"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          role="menu"
        >
          {!contextMenu.nodeId && (
            <button
              type="button"
              disabled={clipboardRef.current.length === 0}
              className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
              onClick={() => {
                pasteClipboard();
                setContextMenu(null);
              }}
            >
              <Clipboard size={14} /> Coller
            </button>
          )}
          {contextMenu.nodeId && (
            <>
          <button
            type="button"
            className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-slate-700"
            onClick={() => {
              removeSelectedNodes();
              setContextMenu(null);
            }}
          >
            <Trash2 size={14} /> Supprimer
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-slate-700"
            onClick={() => {
              clipboardRef.current = cloneElements(selectedElements());
              pasteClipboard();
              setContextMenu(null);
            }}
          >
            <Copy size={14} /> Dupliquer
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-slate-700"
            onClick={() => {
              clipboardRef.current = cloneElements(selectedElements());
              setContextMenu(null);
            }}
          >
            <Copy size={14} /> Copier
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-slate-700"
            onClick={() => {
              clipboardRef.current = cloneElements(selectedElements());
              removeSelectedNodes();
              setContextMenu(null);
            }}
          >
            <Scissors size={14} /> Couper
          </button>
          <button
            type="button"
            disabled={clipboardRef.current.length === 0}
            className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
            onClick={() => {
              pasteClipboard();
              setContextMenu(null);
            }}
          >
            <Clipboard size={14} /> Coller
          </button>
          {selectedNodeIds.length > 1 && (
            <>
              <div className="my-1 border-t border-gray-200 dark:border-slate-600" />
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-slate-700"
                onClick={() => {
                  alignSelectedNodes("horizontal");
                  setContextMenu(null);
                }}
              >
                <AlignCenterHorizontal size={14} /> Aligner horizontalement
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-slate-700"
                onClick={() => {
                  alignSelectedNodes("vertical");
                  setContextMenu(null);
                }}
              >
                <AlignCenterVertical size={14} /> Aligner verticalement
              </button>
            </>
          )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function FlowCanvas(props: FlowCanvasProps) {
  return (
    <ReactFlowProvider>
      <FlowCanvasContent {...props} />
    </ReactFlowProvider>
  );
}