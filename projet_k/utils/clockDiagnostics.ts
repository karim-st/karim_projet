import { ClockTreeFile, ClockDiagnostic } from "../types/clock";

export function collectProjectDiagnostics(project: ClockTreeFile): ClockDiagnostic[] {
  const diagnostics: ClockDiagnostic[] = [];
  const elements = project.tree.elements || [];
  const transitions = project.tree.transitions || [];

  // 1. Check duplicate IDs
  const seenIds = new Set<string>();
  for (const node of elements) {
    if (seenIds.has(node.id)) {
      diagnostics.push({
        id: `dup_id_${node.id}`,
        nodeId: node.id,
        level: "error",
        message: `L'identifiant de bloc "${node.id}" est dupliqué.`
      });
    }
    seenIds.add(node.id);
  }

  // 2. Check bounds and parameter validity
  for (const node of elements) {
    // Check min / max bounds
    if (node.min !== undefined && node.max !== undefined && node.min > node.max) {
      diagnostics.push({
        id: `bounds_range_${node.id}`,
        nodeId: node.id,
        level: "error",
        message: `La valeur minimale (${node.min}) ne doit pas dépasser la valeur maximale (${node.max}).`
      });
    }

    const currentValue = Number(node.value ?? node.default);
    if (!isNaN(currentValue)) {
      if (node.min !== undefined && currentValue < node.min) {
        diagnostics.push({
          id: `val_below_min_${node.id}`,
          nodeId: node.id,
          level: "warn",
          message: `La valeur actuelle (${currentValue}) est inférieure au minimum autorisé (${node.min}).`
        });
      }
      if (node.max !== undefined && currentValue > node.max) {
        diagnostics.push({
          id: `val_above_max_${node.id}`,
          nodeId: node.id,
          level: "warn",
          message: `La valeur actuelle (${currentValue}) est supérieure au maximum autorisé (${node.max}).`
        });
      }
    }

    // Divider check (positive and non-zero)
    if (node.type === "divider") {
      const divCoeff = Number(node.value ?? node.default ?? 1);
      if (isNaN(divCoeff) || divCoeff <= 0) {
        diagnostics.push({
          id: `divider_coeff_${node.id}`,
          nodeId: node.id,
          level: "error",
          message: `Le coefficient du diviseur doit être strictement positif.`
        });
      }
    }
  }

  // 3. Check transition connections
  const elementIds = new Set(elements.map(e => e.id));
  for (const edge of transitions) {
    if (!elementIds.has(edge.sourceTaskId)) {
      diagnostics.push({
        id: `missing_source_${edge.id}`,
        message: `La connexion "${edge.id}" fait référence à une source inexistante "${edge.sourceTaskId}".`,
        level: "error"
      });
    }
    if (!elementIds.has(edge.targetTaskId)) {
      diagnostics.push({
        id: `missing_target_${edge.id}`,
        message: `La connexion "${edge.id}" fait référence à une cible inexistante "${edge.targetTaskId}".`,
        level: "error"
      });
    }
  }

  // 4. Check for cycles (DFS topological sort traversal)
  const adjacency = new Map<string, string[]>();
  for (const edge of transitions) {
    const list = adjacency.get(edge.sourceTaskId) || [];
    list.push(edge.targetTaskId);
    adjacency.set(edge.sourceTaskId, list);
  }

  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  let hasCycle = false;

  function detectCycleDFS(nodeId: string): boolean {
    visited.add(nodeId);
    recursionStack.add(nodeId);

    const neighbors = adjacency.get(nodeId) || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        if (detectCycleDFS(neighbor)) return true;
      } else if (recursionStack.has(neighbor)) {
        diagnostics.push({
          id: `cycle_detected_${nodeId}_${neighbor}`,
          nodeId: nodeId,
          level: "error",
          message: `Une boucle d'horloge (cycle) a été détectée contenant le nœud "${neighbor}".`
        });
        hasCycle = true;
        return true;
      }
    }

    recursionStack.delete(nodeId);
    return false;
  }

  for (const node of elements) {
    if (!visited.has(node.id)) {
      if (detectCycleDFS(node.id)) {
        // Stop cycle reporting after first found to prevent spam
        break;
      }
    }
  }

  return diagnostics;
}
