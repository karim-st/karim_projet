import { Node, Edge, MarkerType } from "reactflow";
import { ClockTreeFile, ClockBaseElement, ClockTransition } from "../types/clock";

const REGISTERED_NODE_TYPES = new Set([
  "variableSource",
  "editableValue",
  "divider",
  "annotation",
  "multiplexer",
  "group"
]);

/**
 * React Flow fails hard on unknown node types: it falls back to the "default"
 * node, which renders `data.label` directly as a React child. A `ClockLabel`
 * object ({ align, text }) would crash with "Objects are not valid as a React
 * child", so labels must always be plain strings and unknown/legacy types must
 * be remapped to a registered node type.
 */
function normalizeFlowType(type: string): string {
  const lower = String(type ?? "").toLowerCase();
  if (lower.startsWith("annotation")) return "annotation";
  if (["mux", "multiplexer", "multiplexor"].includes(lower)) return "multiplexer";
  if (REGISTERED_NODE_TYPES.has(type)) return type;
  return "editableValue";
}

function normalizeLabelText(element: ClockBaseElement): string {
  return typeof element.label === "string" ? element.label : element.label?.text ?? element.id;
}

export function clockTreeToFlow(project: ClockTreeFile): { nodes: Node[]; edges: Edge[] } {
  const elements = project.tree.elements || [];
  const transitions = project.tree.transitions || [];
  const groups = project.tree.groups || [];

  const nodes: Node[] = [];
  const edges: Edge[] = [];

  // 1. Map standard elements
  for (const element of elements) {
    const labelText = normalizeLabelText(element);
    const flowType = normalizeFlowType(element.type);

    nodes.push({
      id: element.id,
      type: flowType,
      position: element.position || { x: 0, y: 0 },
      data: {
        ...element,
        label: labelText,
        title: labelText,
        raw: { id: element.id }
      },
      width: element.size?.width,
      height: element.size?.height,
      style: {
        width: element.size?.width,
        height: element.size?.height
      }
    });
  }

  // 2. Map groups
  for (const group of groups) {
    nodes.push({
      id: group.id,
      type: "group",
      position: group.position || { x: 0, y: 0 },
      data: {
        label: group.label,
        groupId: group.id,
        collapsed: group.collapsed || false,
        readOnly: false
      },
      width: group.size?.width || 320,
      height: group.size?.height || 180,
      style: {
        width: group.size?.width || 320,
        height: group.size?.height || 180,
        zIndex: -2
      }
    });
  }

  // 3. Map transitions to edges
  for (const edge of transitions) {
    const isMuxTarget = edge.targetPortId && edge.targetPortId.includes("__");
    
    edges.push({
      id: edge.id,
      source: edge.sourceTaskId,
      target: edge.targetTaskId,
      sourceHandle: edge.sourcePortId || "output",
      targetHandle: edge.targetPortId || "input",
      type: "routingEdge",
      label: isMuxTarget ? undefined : edge.startLabel || edge.endLabel || "",
      data: {
        routingPoints: edge.transitionRoutingPoint || [],
        labelPosition: edge.labelPosition,
        lineStyle: edge.lineStyle || "normal",
        hasError: edge.hasError || false
      }
    });
  }

  return { nodes, edges };
}
