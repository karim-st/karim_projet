import { ClockTreeFile, ClockDiagnostic, ClockTransition } from "../types/clock";
import { collectBlockRuleViolations, normalizeRef, toDiagnostic } from "./clockRules";

/**
 * Contrôle global de cohérence de l'arbre d'horloge (spec §9).
 *
 * - Structure générale : versions, racine de l'arbre, types autorisés.
 * - Identifiants et références : unicité, existence, destinataires cohérents.
 * - Valeurs : plages, valeur par défaut, listes fermées, coefficients.
 * - Multiplexeurs : entrées possibles, entrée par défaut, sources référencées.
 * - Métier matériel : bloc/rôle, sécurité, liens orphelins.
 *
 * Les erreurs sont retournées sous forme structurée (bloc et champ concernés).
 */
export function collectProjectDiagnostics(project: ClockTreeFile): ClockDiagnostic[] {
  const diagnostics: ClockDiagnostic[] = [];

  collectStructureDiagnostics(project, diagnostics);
  collectReferenceDiagnostics(project, diagnostics);
  collectTargetUniquenessDiagnostics(project, diagnostics);
  collectMuxCoherenceDiagnostics(project, diagnostics);

  diagnostics.push(
    ...collectBlockRuleViolations(project).map((violation) =>
      toDiagnostic(violation, "rule")
    )
  );

  collectCycleDiagnostics(project, diagnostics);

  return diagnostics;
}

function collectStructureDiagnostics(project: ClockTreeFile, diagnostics: ClockDiagnostic[]): void {
  if (!project.master_clock_version) {
    diagnostics.push({
      id: "structure_master_version",
      field: "master_clock_version",
      message: "La version générale du descripteur est manquante.",
      level: "error"
    });
  }
  if (!project.version) {
    diagnostics.push({
      id: "structure_version",
      field: "version",
      message: "La version du descripteur est manquante.",
      level: "error"
    });
  }
  if (!project.tree) {
    diagnostics.push({
      id: "structure_tree_missing",
      message: "La racine de l'arbre d'horloge est absente.",
      level: "error"
    });
    return;
  }
  if (!project.tree.id) {
    diagnostics.push({
      id: "structure_tree_id",
      field: "id",
      message: "L'identifiant de l'arbre d'horloge est manquant.",
      level: "error"
    });
  }
  if (!project.tree.schema_version) {
    diagnostics.push({
      id: "structure_schema_version",
      field: "schema_version",
      message: "La version de schéma de l'arbre est manquante.",
      level: "error"
    });
  }
  if (!Array.isArray(project.tree.elements)) {
    diagnostics.push({
      id: "structure_elements",
      field: "elements",
      message: "La liste des blocs d'horloge est absente.",
      level: "error"
    });
  }
  if (!Array.isArray(project.tree.transitions)) {
    diagnostics.push({
      id: "structure_transitions",
      field: "transitions",
      message: "La liste des connexions est absente.",
      level: "error"
    });
  }
}

function collectReferenceDiagnostics(project: ClockTreeFile, diagnostics: ClockDiagnostic[]): void {
  const elements = project.tree.elements ?? [];
  const transitions = project.tree.transitions ?? [];

  const seenIds = new Set<string>();
  for (const node of elements) {
    if (seenIds.has(node.id)) {
      diagnostics.push({
        id: `dup_id_${node.id}`,
        nodeId: node.id,
        message: `L'identifiant de bloc "${node.id}" est dupliqué.`,
        level: "error"
      });
    }
    seenIds.add(node.id);
  }

  const elementIds = new Set(elements.map((element) => element.id));
  for (const edge of transitions) {
    if (!elementIds.has(edge.sourceTaskId)) {
      diagnostics.push({
        id: `missing_source_${edge.id}`,
        nodeId: edge.targetTaskId,
        field: "sourceTaskId",
        message: `La connexion "${edge.id}" référence une source inexistante "${edge.sourceTaskId}".`,
        level: "error"
      });
    }
    if (!elementIds.has(edge.targetTaskId)) {
      diagnostics.push({
        id: `missing_target_${edge.id}`,
        nodeId: edge.sourceTaskId,
        field: "targetTaskId",
        message: `La connexion "${edge.id}" référence une cible inexistante "${edge.targetTaskId}".`,
        level: "error"
      });
    }
    if (edge.sourceTaskId === edge.targetTaskId) {
      diagnostics.push({
        id: `self_loop_${edge.id}`,
        nodeId: edge.sourceTaskId,
        message: `La connexion "${edge.id}" relie un bloc "${edge.sourceTaskId}" à lui-même.`,
        level: "error"
      });
    }
  }

  // Destinataires dupliqués dans un bloc.
  for (const node of elements) {
    const targets = node.outputTargets ?? [];
    const seenTargets = new Set<string>();
    for (const target of targets) {
      if (seenTargets.has(target)) {
        diagnostics.push({
          id: `dup_target_${node.id}_${target}`,
          nodeId: node.id,
          field: "outputTargets",
          message: `Le destinataire "${target}" figure plusieurs fois dans la liste du bloc "${node.id}".`,
          level: "error"
        });
      }
      seenTargets.add(target);
    }
  }

  // Cohérence entre connexions et destinataires.
  const targetIdsPerSource = new Map<string, Set<string>>();
  for (const edge of transitions) {
    const source = normalizeRef(edge.sourceTaskId);
    const target = normalizeRef(edge.targetTaskId);
    const set = targetIdsPerSource.get(source) ?? new Set<string>();
    set.add(target);
    targetIdsPerSource.set(source, set);
  }
  for (const node of elements) {
    const connectedTargets = targetIdsPerSource.get(node.id) ?? new Set<string>();
    const declaredTargets = new Set(node.outputTargets ?? []);
    for (const connected of connectedTargets) {
      if (!declaredTargets.has(connected)) {
        diagnostics.push({
          id: `target_not_declared_${node.id}_${connected}`,
          nodeId: node.id,
          field: "outputTargets",
          message: `Le bloc "${node.id}" est relié à "${connected}" mais ne le déclare pas parmi ses destinataires.`,
          level: "error"
        });
      }
    }
    for (const declared of declaredTargets) {
      if (!connectedTargets.has(declared)) {
        diagnostics.push({
          id: `declared_not_connected_${node.id}_${declared}`,
          nodeId: node.id,
          field: "outputTargets",
          message: `Le bloc "${node.id}" déclare le destinataire "${declared}" sans connexion correspondante.`,
          level: "error"
        });
      }
    }
  }

  // Existence des références après renommage/suppression (entrées de multiplexeur).
  const muxesById = new Map(elements.filter((element) => isMuxType(element.type)).map((element) => [element.id, element]));
  const sourceIds = new Set<string>();
  for (const edge of transitions) sourceIds.add(edge.sourceTaskId);
  for (const mux of muxesById.values()) {
    for (const input of mux.possible_Input ?? []) {
      if (!input.from) continue;
      const from = normalizeRef(input.from);
      if (elementIds.has(from) && !sourceIds.has(input.from) && !sourceIds.has(from)) {
        diagnostics.push({
          id: `mux_source_dangling_${mux.id}_${input.input_Id}`,
          nodeId: mux.id,
          field: "possible_Input",
          message: `L'entrée "${input.input_Id}" du multiplexeur "${mux.id}" référence la source "${input.from}" sans connexion associée.`,
          level: "warn"
        });
      }
    }
  }
}

function isMuxType(type: string | undefined): boolean {
  return ["mux", "multiplexer", "multiplexor"].includes(String(type ?? "").toLowerCase());
}

function isSourceLike(type: string | undefined): boolean {
  const normalized = String(type ?? "").toLowerCase();
  return normalized.includes("source") || normalized.includes("oscillator") || normalized.includes("mux");
}

function collectTargetUniquenessDiagnostics(project: ClockTreeFile, diagnostics: ClockDiagnostic[]): void {
  const elements = project.tree.elements ?? [];
  const transitions = project.tree.transitions ?? [];
  const byTarget = new Map<string, ClockTransition[]>();
  for (const transition of transitions) {
    if (!transition.targetTaskId) continue;
    const list = byTarget.get(transition.targetTaskId) ?? [];
    list.push(transition);
    byTarget.set(transition.targetTaskId, list);
  }

  for (const node of elements) {
    const incoming = byTarget.get(node.id) ?? [];
    if (isMuxType(node.type)) {
      // Un multiplexeur ne doit recevoir qu'une seule connexion par entrée.
      const byPort = new Map<string, ClockTransition[]>();
      for (const transition of incoming) {
        const port = transition.targetPortId ?? "input";
        const list = byPort.get(port) ?? [];
        list.push(transition);
        byPort.set(port, list);
      }
      for (const [port, list] of byPort) {
        if (list.length > 1) {
          diagnostics.push({
            id: `mux_port_duplicate_${node.id}_${port}`,
            nodeId: node.id,
            field: "transitions",
            message: `Le multiplexeur "${node.id}" reçoit ${list.length} connexions sur la même entrée "${port}".`,
            level: "error"
          });
        }
      }
    } else if (!isSourceLike(node.type) && incoming.length > 1) {
      const inputPorts = incoming.filter((transition) => (transition.targetPortId ?? "input") === "input");
      if (inputPorts.length > 1) {
        diagnostics.push({
          id: `target_multiple_inputs_${node.id}`,
          nodeId: node.id,
          field: "transitions",
          message: `Le bloc "${node.id}" reçoit ${inputPorts.length} connexions sur son entrée unique.`,
          level: "error"
        });
      }
    }
  }
}

function collectMuxCoherenceDiagnostics(project: ClockTreeFile, diagnostics: ClockDiagnostic[]): void {
  const elements = project.tree.elements ?? [];
  const transitions = project.tree.transitions ?? [];

  for (const mux of elements) {
    if (!isMuxType(mux.type)) continue;
    const inputs = mux.possible_Input ?? [];
    const handles = new Set<string>();

    for (const transition of transitions) {
      if (transition.targetTaskId !== mux.id) continue;
      const port = transition.targetPortId ?? "";
      if (!port || port === "input") {
        if (!cosmeticOnly(transition)) {
          diagnostics.push({
            id: `mux_transition_no_handle_${transition.id}`,
            nodeId: mux.id,
            field: "transitions",
            message: `La connexion "${transition.id}" cible le multiplexeur "${mux.id}" sans port d'entrée précisé.`,
            level: "warn"
          });
        }
        continue;
      }
      handles.add(port);

      const handle = String(port).replace(`${mux.id}__`, "");
      const declared = inputs.some((input) => input.input_Id === handle || input.input_Id === port);
      if (!declared) {
        diagnostics.push({
          id: `mux_transition_undeclared_${transition.id}`,
          nodeId: mux.id,
          field: "possible_Input",
          message: `La connexion "${transition.id}" cible l'entrée "${handle}" qui n'est pas déclarée dans le multiplexeur "${mux.id}".`,
          level: "error"
        });
      }
    }
  }
}

function cosmeticOnly(transition: ClockTransition): boolean {
  return Boolean(transition.isVirtual);
}

function collectCycleDiagnostics(project: ClockTreeFile, diagnostics: ClockDiagnostic[]): void {
  const elements = project.tree.elements ?? [];
  const transitions = project.tree.transitions ?? [];

  const adjacency = new Map<string, string[]>();
  for (const edge of transitions) {
    if (!edge.sourceTaskId || !edge.targetTaskId) continue;
    const list = adjacency.get(edge.sourceTaskId) ?? [];
    list.push(edge.targetTaskId);
    adjacency.set(edge.sourceTaskId, list);
  }

  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  const detectCycleDFS = (nodeId: string): boolean => {
    visited.add(nodeId);
    recursionStack.add(nodeId);
    const neighbors = adjacency.get(nodeId) ?? [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        if (detectCycleDFS(neighbor)) return true;
      } else if (recursionStack.has(neighbor)) {
        diagnostics.push({
          id: `cycle_detected_${nodeId}_${neighbor}`,
          nodeId,
          level: "error",
          message: `Une boucle d'horloge (cycle) a été détectée contenant le nœud "${neighbor}".`
        });
        return true;
      }
    }
    recursionStack.delete(nodeId);
    return false;
  };

  for (const node of elements) {
    if (!visited.has(node.id)) {
      if (detectCycleDFS(node.id)) break;
    }
  }
}