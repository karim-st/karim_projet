import { ClockTreeFile, ClockBaseElement, ClockTransition } from "../types/clock";
import { reconcileOutputTargets } from "./clockConnections";

export function propagateClockFrequencies(project: ClockTreeFile): ClockTreeFile {
  const elements = reconcileOutputTargets(project.tree.elements || [], project.tree.transitions || []);
  const transitions = project.tree.transitions || [];

  // Helper to find input connection for a standard node (non-mux)
  const getInputTransition = (nodeId: string): ClockTransition | undefined => {
    return transitions.find(t => t.targetTaskId === nodeId);
  };

  // Helper to find selected input connection for a multiplexer
  const getMuxInputTransition = (node: ClockBaseElement): ClockTransition | undefined => {
    const selectedInputId = node.muxState?.selectedInputId || String(node.value || node.default || "");
    if (!selectedInputId) return undefined;
    
    // Find the transition that maps to this input handle
    return transitions.find(t => 
      t.targetTaskId === node.id && 
      (t.targetPortId === selectedInputId || t.targetPortId === `${node.id}__${selectedInputId}`)
    );
  };

  // Helper to check if a node is a source
  const isSourceNode = (node: ClockBaseElement): boolean => {
    const t = String(node.type || "").toLowerCase();
    return t.includes("source") || t.includes("oscillator");
  };

  // Initialize all computed values to undefined or default/value if it's a source
  const computedFreqs = new Map<string, number>();

  // Map to store node objects by ID for quick access
  const nodeMap = new Map<string, ClockBaseElement>();
  for (const el of elements) {
    nodeMap.set(el.id, el);
  }

  // Iterate to resolve frequencies (up to 10 iterations to prevent infinite loops on cycles)
  let changed = true;
  let iterations = 0;
  const maxIterations = 50;

  while (changed && iterations < maxIterations) {
    changed = false;
    iterations++;

    for (const node of elements) {
      let freq: number | undefined = undefined;

      if (isSourceNode(node) || node.type === "editableValue") {
        // Source nodes have their own frequency
        const val = Number(node.value ?? node.default ?? 0);
        if (!isNaN(val)) {
          freq = val;
        }
      } else if (node.type === "multiplexer") {
        // Multiplexer selects from one of its input transitions
        const inputTransition = getMuxInputTransition(node);
        if (inputTransition) {
          const sourceId = inputTransition.sourceTaskId;
          if (computedFreqs.has(sourceId)) {
            freq = computedFreqs.get(sourceId);
          }
        }
      } else {
        // Standard transformation nodes (Divider, Multiplier, etc.)
        const inputTransition = getInputTransition(node.id);
        if (inputTransition) {
          const sourceId = inputTransition.sourceTaskId;
          if (computedFreqs.has(sourceId)) {
            const inFreq = computedFreqs.get(sourceId)!;
            const factor = Number(node.value ?? node.default ?? 1);

            if (node.type === "divider") {
              freq = factor !== 0 ? inFreq / factor : 0;
            } else if (node.type === "multiplier") {
              freq = inFreq * factor;
            } else if (node.type === "fractionalValue") {
              const base = Number(node.base ?? 2);
              const power = Number(node.power ?? 0);
              const mult = Number(node.factor ?? 1);
              freq = inFreq * Math.pow(base, power) * mult;
            } else {
              // Default pass-through
              freq = inFreq;
            }
          }
        }
      }

      if (freq !== undefined && computedFreqs.get(node.id) !== freq) {
        computedFreqs.set(node.id, freq);
        changed = true;
      }
    }
  }

  // Map values back to elements
  const updatedElements = elements.map(node => {
    const computedVal = computedFreqs.get(node.id);
    return {
      ...node,
      computedValue: computedVal !== undefined ? (Math.round(computedVal * 1000) / 1000) : ""
    };
  });

  return {
    ...project,
    tree: {
      ...project.tree,
      elements: updatedElements
    }
  };
}
