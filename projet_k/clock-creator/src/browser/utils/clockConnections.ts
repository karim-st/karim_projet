import type {
  ClockBaseElement,
  ClockTreeFile,
  ClockTransition
} from "../types/clock";
import { normalizeRef } from "./clockRules";

/**
 * Gestion des connexions (spec §7).
 *
 * - La création suit une séquence de contrôles : existence des blocs,
 *   interdiction d'auto-connexion, interdiction de doublon, cible valide.
 * - La connexion graphique et la liste des destinataires (`outputTargets`)
 *   du bloc source doivent toujours rester cohérentes.
 */

export interface ConnectionCandidate {
  sourceTaskId: string;
  targetTaskId: string;
  sourcePortId?: string;
  targetPortId?: string;
}

export interface ConnectionValidation {
  ok: boolean;
  error?: string;
}

export function isMuxLikeType(type: string | undefined): boolean {
  return ["mux", "multiplexer", "multiplexor"].includes(
    String(type ?? "").toLowerCase()
  );
}

export function isSourceLikeType(type: string | undefined): boolean {
  const normalized = String(type ?? "").toLowerCase();
  return (
    normalized.includes("source") ||
    normalized.includes("oscillator") ||
    normalized.includes("mux")
  );
}

/**
 * Contrôles métier appliqués avant la création d'une connexion :
 * 1. la source et la cible doivent exister ;
 * 2. une connexion ne doit pas relier un bloc à lui-même ;
 * 3. une connexion identique ne doit pas déjà exister ;
 * 4. la cible doit accepter l'entrée demandée (port explicite).
 */
export function validateConnection(
  project: ClockTreeFile,
  candidate: ConnectionCandidate,
  ignoredEdgeId?: string
): ConnectionValidation {
  const elements = project.tree.elements ?? [];
  const transitions = project.tree.transitions ?? [];
  const { sourceTaskId, targetTaskId } = candidate;

  if (!sourceTaskId || !targetTaskId) {
    return { ok: false, error: "Une connexion nécessite une source et une cible." };
  }

  const source = elements.find((element) => element.id === sourceTaskId);
  const target = elements.find((element) => element.id === targetTaskId);
  if (!source) {
    return { ok: false, error: `La source "${sourceTaskId}" n'existe pas.` };
  }
  if (!target) {
    return { ok: false, error: `La cible "${targetTaskId}" n'existe pas.` };
  }

  if (sourceTaskId === targetTaskId) {
    return { ok: false, error: "Un bloc d'horloge ne peut pas être relié à lui-même." };
  }

  const targetPortId = candidate.targetPortId ?? "input";

  // Une cible source ne reçoit pas de connexion entrante.
  if (isSourceLikeType(target.type) && !isMuxLikeType(target.type)) {
    return { ok: false, error: `La cible "${targetTaskId}" est une source et ne peut pas recevoir de connexion.` };
  }

  // La cible d'un multiplexeur doit être un port d'entrée déclaré.
  if (isMuxLikeType(target.type)) {
    const handle = String(targetPortId).replace(`${targetTaskId}__`, "");
    const declared =
      (target.possible_Input ?? []).some((input) => input.input_Id === handle) ||
      (target.possible_Input ?? []).some((input) => input.input_Id === targetPortId);
    if (!declared) {
      return {
        ok: false,
        error: `L'entrée "${handle}" n'est pas déclarée dans le multiplexeur "${targetTaskId}".`
      };
    }
  } else if (targetPortId !== "input") {
    return { ok: false, error: `La cible "${targetTaskId}" n'expose pas le port d'entrée demandé.` };
  }

  // Interdiction des connexions identiques.
  const duplicated = transitions.find(
    (transition) =>
      transition.id !== ignoredEdgeId &&
      transition.sourceTaskId === sourceTaskId &&
      transition.targetTaskId === targetTaskId &&
      (transition.targetPortId ?? "input") === targetPortId
  );
  if (duplicated) {
    return {
      ok: false,
      error: `Une connexion identique existe déjà entre "${sourceTaskId}" et "${targetTaskId}".`
    };
  }

  // Unicité de la cible non-multiplexée.
  if (!isMuxLikeType(target.type) && targetPortId === "input") {
    const alreadyTargeted = transitions.some(
      (transition) =>
        transition.id !== ignoredEdgeId &&
        transition.targetTaskId === targetTaskId &&
        (transition.targetPortId ?? "input") === "input"
    );
    if (alreadyTargeted) {
      return {
        ok: false,
        error: `Le bloc "${targetTaskId}" reçoit déjà une connexion sur son entrée unique.`
      };
    }
  }

  // Interdiction de créer une boucle d'horloge (cycle).
  if (createsCycle(transitions, candidate, ignoredEdgeId)) {
    return {
      ok: false,
      error: "Cette connexion créerait une boucle d'horloge (cycle)."
    };
  }

  return { ok: true };
}

function createsCycle(
  transitions: ClockTransition[],
  candidate: ConnectionCandidate,
  ignoredEdgeId?: string
): boolean {
  const adjacency = new Map<string, string[]>();
  for (const transition of transitions) {
    if (transition.id === ignoredEdgeId) continue;
    const source = transition.sourceTaskId;
    const target = transition.targetTaskId;
    adjacency.set(source, [...(adjacency.get(source) ?? []), target]);
  }

  const queue = [candidate.targetTaskId];
  const visited = new Set<string>();
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === candidate.sourceTaskId) return true;
    if (visited.has(current)) continue;
    visited.add(current);
    queue.push(...(adjacency.get(current) ?? []));
  }
  return false;
}

/**
 * Reconstruit la liste des destinataires (`outputTargets`) de chaque bloc à
 * partir des connexions réelles. Garantit que la connexion graphique et la
 * liste des destinataires ne divergent jamais (spec §7).
 */
export function reconcileOutputTargets(elements: ClockBaseElement[], transitions: ClockTransition[]): ClockBaseElement[] {
  const targetsBySource = new Map<string, string[]>();
  for (const transition of transitions) {
    const sourceId = normalizeRef(transition.sourceTaskId);
    if (!sourceId) continue;
    const targetId = normalizeRef(transition.targetTaskId);
    const list = targetsBySource.get(sourceId) ?? [];
    if (!list.includes(targetId)) list.push(targetId);
    targetsBySource.set(sourceId, list);
  }

  return elements.map((element) => ({
    ...element,
    outputTargets: targetsBySource.get(element.id) ?? []
  }));
}

/**
 * Construit la liste des transitions (`transitions`) à partir des liaisons
 * déclarées (`outputTargets`) de chaque bloc. C'est la démarque inverse de
 * `reconcileOutputTargets` : `outputTargets` est la source de vérité.
 *
 * - les transitions existantes correspondant à un couple source→cible sont
 *   réutilisées telles quelles (ports, labels, routage) ;
 * - les nouvelles liaisons reçoivent un identifiant stable et, pour une cible
 *   multiplexeur, le port d'entrée déclaré correspondant à la source ;
 * - une transition existante non soutenue par `outputTargets` est conservée
 *   ET ajoutée aux `outputTargets` du bloc source, afin que le diagramme et
 *   les liaisons déclarées restent strictement cohérents (spec §7).
 */
export function deriveTransitionsFromOutputTargets(
  elements: ClockBaseElement[],
  existingTransitions: ClockTransition[]
): {
  transitions: ClockTransition[];
  elements: ClockBaseElement[];
} {
  const keyOf = (source: string, target: string) => `${normalizeRef(source)}::${normalizeRef(target)}`;

  const byKey = new Map<string, ClockTransition>();
  for (const transition of existingTransitions) {
    const key = keyOf(transition.sourceTaskId, transition.targetTaskId);
    if (!byKey.has(key)) byKey.set(key, transition);
  }

  const elementsById = new Map(elements.map((element) => [element.id, element]));

  const transitions: ClockTransition[] = [];
  const covered = new Set<string>();

  for (const element of elements) {
    for (const rawTarget of Array.isArray(element.outputTargets) ? element.outputTargets : []) {
      const target = normalizeRef(rawTarget);
      if (!target) continue;
      const key = keyOf(element.id, target);
      if (covered.has(key)) continue;
      covered.add(key);

      const existing = byKey.get(key);
      const targetElement = elementsById.get(target);
      if (existing) {
        // Ids de descripteurs exportés (suffixes `_input`/`_output`/`__port`)
        // normalisés vers les ids internes des nœuds, sinon React Flow ignore
        // l'arête (aucun nœud « LSI_output » n'existe).
        const sourceId = normalizeRef(existing.sourceTaskId) || existing.sourceTaskId;
        const targetId = normalizeRef(existing.targetTaskId) || existing.targetTaskId;
        let targetPortId = existing.targetPortId;
        if (!targetPortId && String(existing.targetTaskId).includes("__")) {
          const rawSuffix = String(existing.targetTaskId).split("__").slice(1).join("__");
          if (targetElement && isMuxLikeType(targetElement.type)) {
            const inputs = targetElement.possible_Input ?? [];
            const suffixNorm = normalizeRef(rawSuffix).toLowerCase();
            const input =
              inputs.find((i) => i.input_Id === rawSuffix) ??
              inputs.find((i) => i.input_Id.toLowerCase() === rawSuffix.toLowerCase()) ??
              inputs.find((i) => normalizeRef(i.from).toLowerCase() === suffixNorm) ??
              inputs.find(
                (i) => normalizeRef(i.from).toLowerCase() === normalizeRef(sourceId).toLowerCase()
              );
            targetPortId = input ? `${targetId}__${input.input_Id}` : undefined;
          }
        }
        transitions.push({
          ...existing,
          sourceTaskId: sourceId,
          targetTaskId: targetId,
          targetPortId
        });
        continue;
      }

      // Cible multiplexeur : relier au port d'entrée déclaré pour la source.
      let targetPortId: string | undefined;
      if (targetElement && isMuxLikeType(targetElement.type)) {
        const sourceNorm = normalizeRef(element.id).toLowerCase();
        const matchingInput = (targetElement.possible_Input ?? []).find(
          (input) =>
            normalizeRef(input.from).toLowerCase().includes(sourceNorm) ||
            String(input.input_Id).toLowerCase().includes(sourceNorm)
        );
        if (matchingInput) {
          targetPortId = `${target}__${matchingInput.input_Id}`;
        }
      }

      transitions.push({
        id: `e_${element.id}_${target}`,
        sourceTaskId: element.id,
        targetTaskId: target,
        targetPortId,
        isVirtual: false
      });
    }
  }

  // Transitions existantes non couvertes par `outputTargets` : conservées et
  // resynchronisées dans `outputTargets` du bloc source (pas de perte).
  // Les ids suffixés (`_input`/`_output`/`__port`) sont aussi normalisés ici.
  const extraTargetsBySource = new Map<string, string[]>();
  for (const transition of existingTransitions) {
    const key = keyOf(transition.sourceTaskId, transition.targetTaskId);
    if (covered.has(key)) continue;
    covered.add(key);
    const sourceId = normalizeRef(transition.sourceTaskId) || transition.sourceTaskId;
    const targetId = normalizeRef(transition.targetTaskId) || transition.targetTaskId;
    transitions.push({ ...transition, sourceTaskId: sourceId, targetTaskId: targetId });
    const list = extraTargetsBySource.get(sourceId) ?? [];
    if (!list.includes(targetId)) list.push(targetId);
    extraTargetsBySource.set(sourceId, list);
  }

  const synchronizedElements = elements.map((element) => {
    const extra = extraTargetsBySource.get(element.id);
    if (!extra || extra.length === 0) return element;
    const merged = [...(element.outputTargets ?? []), ...extra];
    const unique = [...new Set(merged)];
    return { ...element, outputTargets: unique };
  });

  return { transitions, elements: synchronizedElements };
}

/**
 * Construit une transition depuis une connexion proposée (identifiant stable).
 */
export function buildTransition(
  project: ClockTreeFile,
  candidate: ConnectionCandidate,
  existingEdgeId?: string
): ClockTransition {
  const source = project.tree.elements.find((element) => element.id === candidate.sourceTaskId);
  const target = project.tree.elements.find((element) => element.id === candidate.targetTaskId);
  const midX = source && target
    ? source.position.x + (target.position.x - source.position.x) / 2
    : 0;
  const midY = source && target
    ? source.position.y + (target.position.y - source.position.y) / 2
    : 0;

  return {
    id: existingEdgeId ?? `edge_${candidate.sourceTaskId}_${candidate.targetTaskId}_${Date.now()}`,
    sourceTaskId: candidate.sourceTaskId,
    targetTaskId: candidate.targetTaskId,
    sourcePortId: candidate.sourcePortId,
    targetPortId: candidate.targetPortId ?? "input",
    labelPosition: { x: midX, y: midY },
    isVirtual: false
  };
}