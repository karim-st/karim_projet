import type {
  ClockBaseElement,
  ClockDiagnostic,
  ClockTreeFile
} from "../types/clock";

/**
 * Règles métier par type de bloc (spec §6) et règles matérielles communes (§3.5 / §9).
 * Chaque règle produit une violation structurée : code, bloc concerné, champ concerné,
 * niveau et message. Ces violations alimentent le contrôle global de cohérence.
 */

export const ALLOWED_CLOCK_TYPES: readonly string[] = [
  "fixedSource",
  "variableSource",
  "discreteSource",
  "editableValue",
  "divider",
  "multiplier",
  "multiplexer",
  "multiplexor",
  "fractionalValue",
  "distinctFrequencyOscillator",
  "group",
  "rectangle",
  "rectangleshape",
  "annotationRectangle",
  "annotationSquare",
  "annotationCircle",
  "annotationText",
  "mux",
  "annotation",
  "input",
  "output",
  "default",
  "variablesourcevalue",
  "discretevalue"
];

export type RuleLevel = "info" | "warn" | "error" | "debug";

export interface ClockRuleViolation {
  code: string;
  nodeId?: string;
  field?: string;
  message: string;
  level: RuleLevel;
}

export function toDiagnostic(violation: ClockRuleViolation, idPrefix = "rule"): ClockDiagnostic {
  return {
    id: `${idPrefix}_${violation.code}${violation.nodeId ? `_${violation.nodeId}` : ""}`,
    nodeId: violation.nodeId,
    field: violation.field,
    message: violation.message,
    level: violation.level
  };
}

export function normType(type: string | undefined): string {
  return String(type ?? "").toLowerCase().replace(/[\s_-]+/g, "");
}

function numeric(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function isMuxType(type: string): boolean {
  return ["mux", "multiplexer", "multiplexor"].includes(normType(type));
}

function isSourceType(type: string): boolean {
  const normalized = normType(type);
  return normalized.includes("source") || normalized.includes("oscillator") || normalized.includes("mux");
}

function isRateType(type: string): boolean {
  return ["divider", "multiplier", "fractionalvalue"].includes(normType(type));
}

function unitTextOf(node: ClockBaseElement): string {
  if (typeof node.unit === "string") return node.unit;
  return node.unit?.text ?? "";
}

/**
 * Valeur par défaut (ou valeur courante) d'un bloc sous forme numérique.
 */
export function effectiveNumber(node: ClockBaseElement): number | undefined {
  return numeric(node.value ?? node.default);
}

/**
 * Règles applicables à un bloc en fonction de son type.
 */
export function collectBlockRuleViolations(project: ClockTreeFile): ClockRuleViolation[] {
  const violations: ClockRuleViolation[] = [];
  const elements = project.tree.elements ?? [];
  const transitions = project.tree.transitions ?? [];

  for (const node of elements) {
    const type = normType(node.type);

    if (!node.id) {
      violations.push({
        code: "missing_id",
        message: "Un bloc n'a pas d'identifiant.",
        level: "error"
      });
      continue;
    }

    if (!node.position) {
      violations.push({
        code: "missing_position",
        nodeId: node.id,
        field: "position",
        message: `Le bloc "${node.id}" n'a pas de position dans le diagramme.`,
        level: "warn"
      });
    }

    if (!ALLOWED_CLOCK_TYPES.includes(String(node.type ?? ""))) {
      violations.push({
        code: "type_not_allowed",
        nodeId: node.id,
        field: "type",
        message: `Le type "${node.type}" du bloc "${node.id}" n'appartient pas à la liste autorisée.`,
        level: "error"
      });
    }

    const value = effectiveNumber(node);
    const min = numeric(node.min);
    const max = numeric(node.max);

    if (min !== undefined && max !== undefined && min > max) {
      violations.push({
        code: "range_inverted",
        nodeId: node.id,
        field: "min",
        message: `Le minimum (${min}) du bloc "${node.id}" ne doit pas dépasser le maximum (${max}).`,
        level: "error"
      });
    }

    if (value !== undefined) {
      if (min !== undefined && value < min) {
        violations.push({
          code: "value_below_min",
          nodeId: node.id,
          field: "value",
          message: `La valeur de base (${value}) du bloc "${node.id}" est inférieure au minimum autorisé (${min}).`,
          level: "error"
        });
      }
      if (max !== undefined && value > max) {
        violations.push({
          code: "value_above_max",
          nodeId: node.id,
          field: "value",
          message: `La valeur de base (${value}) du bloc "${node.id}" est supérieure au maximum autorisé (${max}).`,
          level: "error"
        });
      }
    }

    if (node.min !== undefined && numeric(node.min) !== undefined && node.min! < 0) {
      violations.push({
        code: "range_not_positive",
        nodeId: node.id,
        field: "min",
        message: `La plage du bloc "${node.id}" contient une valeur négative ; une fréquence positive est attendue.`,
        level: "warn"
      });
    }

    collectUnitAndNumericViolations(node, violations);
    collectDiscreteValueViolations(node, violations);
    collectRateViolations(node, violations);
    collectFractionalViolations(node, violations);
    collectMuxViolations(node, elements, violations);
    collectHardwareViolations(node, violations);

    if (node.clocked_instance !== undefined && node.clocked_instance !== null) {
      if (!Array.isArray(node.clocked_instance)) {
        violations.push({
          code: "clocked_instances_type",
          nodeId: node.id,
          field: "clocked_instance",
          message: `La liste d'instances alimentées du bloc "${node.id}" doit être une liste.`,
          level: "warn"
        });
      }
    }
  }

  // Règles transverses : les connexions sortantes doivent référencer des blocs existants.
  const elementIds = new Set(elements.map((element) => element.id));
  for (const node of elements) {
    for (const targetId of node.outputTargets ?? []) {
      if (!elementIds.has(targetId)) {
        violations.push({
          code: "output_target_missing",
          nodeId: node.id,
          field: "outputTargets",
          message: `Le bloc "${node.id}" référence un destinataire inexistant "${targetId}".`,
          level: "warn"
        });
      }
    }
    for (const transition of transitions) {
      if (normalizeRef(transition.sourceTaskId) !== node.id) continue;
      if (!node.outputTargets?.includes(normalizeRef(transition.targetTaskId))) {
        violations.push({
          code: "output_target_out_of_sync",
          nodeId: node.id,
          field: "outputTargets",
          message: `La connexion "${transition.id}" part du bloc "${node.id}" mais "${normalizeRef(transition.targetTaskId)}" n'est pas dans sa liste de destinataires.`,
          level: "error"
        });
        break;
      }
    }
  }

  return violations;
}

/**
 * Règles d'unité et de valeur numérique des blocs à valeur unique
 * (§6.1 et §6.4) : une source fixe ou une valeur éditable doit être
 * exploitable comme fréquence (unité définie, valeur numérique).
 */
function collectUnitAndNumericViolations(
  node: ClockBaseElement,
  violations: ClockRuleViolation[]
): void {
  const type = normType(node.type);
  const singleValueTypes = [
    "fixedsource",
    "variablesource",
    "editablevalue",
    "distinctfrequencyoscillator"
  ];
  if (!singleValueTypes.includes(type)) return;

  if (!unitTextOf(node).trim()) {
    violations.push({
      code: "unit_missing",
      nodeId: node.id,
      field: "unit",
      message: `L'unité du bloc "${node.id}" doit être définie pour interpréter sa fréquence.`,
      level: "warn"
    });
  }

  if (type === "fixedsource" || type === "editablevalue") {
    for (const key of ["value", "default"] as const) {
      const raw = node[key];
      if (raw === undefined || raw === null || raw === "") continue;
      if (typeof raw === "number" || numeric(raw) !== undefined) continue;
      violations.push({
        code: "single_value_not_numeric",
        nodeId: node.id,
        field: key,
        message: `La ${key === "value" ? "valeur" : "valeur par défaut"} "${raw}" du bloc "${node.id}" doit être numérique pour être exploitée comme fréquence.`,
        level: "error"
      });
    }
  }
}

function collectDiscreteValueViolations(
  node: ClockBaseElement,
  violations: ClockRuleViolation[]
): void {
  if (!["discretesource", "discretevalue"].includes(normType(node.type))) return;

  const choices = Array.isArray(node.oneOf) ? node.oneOf : [];
  if (choices.length === 0) {
    violations.push({
      code: "discrete_no_choice",
      nodeId: node.id,
      field: "oneOf",
      message: `La source discrète "${node.id}" doit proposer au moins un choix.`,
      level: "error"
    });
    return;
  }

  const seen = new Set<string>();
  for (const choice of choices) {
    const key = `${choice.const}`;
    if (seen.has(key)) {
      violations.push({
        code: "discrete_duplicate",
        nodeId: node.id,
        field: "oneOf",
        message: `La valeur "${choice.const}" apparaît plusieurs fois dans les choix de la source discrète "${node.id}".`,
        level: "error"
      });
    }
    seen.add(key);

    const title = (choice as { title?: unknown }).title;
    if (title === undefined || String(title).trim() === "") {
      violations.push({
        code: "discrete_choice_title_missing",
        nodeId: node.id,
        field: "oneOf",
        message: `Le choix "${choice.const}" du bloc "${node.id}" doit posséder un titre identifiable.`,
        level: "warn"
      });
    }
  }

  const defaultKey = `${node.default ?? node.value ?? ""}`;
  if (defaultKey !== "" && !seen.has(defaultKey)) {
    violations.push({
      code: "discrete_default_missing",
      nodeId: node.id,
      field: "default",
      message: `La valeur par défaut "${node.default ?? node.value}" de "${node.id}" ne correspond à aucun choix autorisé.`,
      level: "error"
    });
  }
}

/**
 * Diviseur et multiplicateur (§6.5 / §6.6) : coefficient strictement positif,
 * valeur par défaut dans la plage ou la liste, liste sans doublon.
 */
function collectRateViolations(node: ClockBaseElement, violations: ClockRuleViolation[]): void {
  if (!["divider", "multiplier"].includes(normType(node.type))) return;
  const label = normType(node.type) === "divider" ? "division" : "multiplication";

  const choiceKeys = Array.isArray(node.oneOf) ? node.oneOf : [];
  if (choiceKeys.length > 0) {
    const seen = new Set<string>();
    for (const choice of choiceKeys) {
      const coeff = numeric(choice.const);
      const key = `${choice.const}`;
      if (seen.has(key)) {
        violations.push({
          code: "rate_coeff_duplicate",
          nodeId: node.id,
          field: "oneOf",
          message: `Le coefficient ${choice.const} apparaît plusieurs fois dans la liste autorisée du bloc "${node.id}".`,
          level: "error"
        });
      }
      seen.add(key);
      if (coeff === undefined || coeff <= 0) {
        violations.push({
          code: "rate_coeff_not_positive",
          nodeId: node.id,
          field: "oneOf",
          message: `Le coefficient de ${label} "${choice.const}" doit être strictement positif.`,
          level: "error"
        });
      }
    }
    const defaultKey = `${node.default ?? node.value ?? ""}`;
    if (defaultKey !== "" && !seen.has(defaultKey)) {
      violations.push({
        code: "rate_default_missing",
        nodeId: node.id,
        field: "default",
        message: `La valeur par défaut "${node.default ?? node.value}" de "${node.id}" doit appartenir à la liste des coefficients autorisés.`,
        level: "error"
      });
    }
    return;
  }

  const value = effectiveNumber(node);
  if (value === undefined) {
    violations.push({
      code: "rate_value_invalid",
      nodeId: node.id,
      field: "value",
      message: `Le coefficient de ${label} du bloc "${node.id}" doit être un nombre valide.`,
      level: "error"
    });
    return;
  }
  if (value <= 0) {
    violations.push({
      code: "rate_value_not_positive",
      nodeId: node.id,
      field: "value",
      message: `Le coefficient de ${label} du bloc "${node.id}" doit être strictement positif.`,
      level: "error"
    });
  }
}

/**
 * Valeur fractionnaire (§6.7) : base et puissance définies, facteur parmi les
 * facteurs autorisés, valeur finale dans les limites configurées.
 */
function collectFractionalViolations(node: ClockBaseElement, violations: ClockRuleViolation[]): void {
  if (!["fractionalvalue"].includes(normType(node.type))) return;

  const base = numeric(node.base);
  const power = numeric(node.power);
  const factor = numeric(node.factor);

  if (base === undefined) {
    violations.push({
      code: "fractional_base_missing",
      nodeId: node.id,
      field: "base",
      message: `La base du bloc fractionnaire "${node.id}" doit être définie.`,
      level: "error"
    });
  }
  if (power === undefined) {
    violations.push({
      code: "fractional_power_missing",
      nodeId: node.id,
      field: "power",
      message: `La puissance du bloc fractionnaire "${node.id}" doit être définie.`,
      level: "error"
    });
  }
  if (factor === undefined) {
    violations.push({
      code: "fractional_factor_missing",
      nodeId: node.id,
      field: "factor",
      message: `Le facteur du bloc fractionnaire "${node.id}" doit être sélectionné.`,
      level: "error"
    });
  }

  const allowedFactors = node.details?.factorMultipliers ?? node.details?.factor_multipliers;
  if (Array.isArray(allowedFactors) && allowedFactors.length > 0 && factor !== undefined) {
    const allowedKeys = allowedFactors.map((entry: unknown) =>
      typeof entry === "object" && entry !== null && "const" in entry
        ? `${(entry as { const: unknown }).const}`
        : `${entry}`
    );
    if (!allowedKeys.includes(`${factor}`)) {
      violations.push({
        code: "fractional_factor_not_allowed",
        nodeId: node.id,
        field: "factor",
        message: `Le facteur ${factor} du bloc "${node.id}" n'appartient pas aux facteurs autorisés.`,
        level: "error"
      });
    }
  }

  if (base !== undefined && power !== undefined && factor !== undefined) {
    const finalValue = Math.pow(base, power) * factor;
    const min = numeric(node.min);
    const max = numeric(node.max);
    if (min !== undefined && finalValue < min) {
      violations.push({
        code: "fractional_below_min",
        nodeId: node.id,
        field: "value",
        message: `La valeur calculée (${finalValue}) du bloc "${node.id}" est inférieure au minimum (${min}).`,
        level: "error"
      });
    }
    if (max !== undefined && finalValue > max) {
      violations.push({
        code: "fractional_above_max",
        nodeId: node.id,
        field: "value",
        message: `La valeur calculée (${finalValue}) du bloc "${node.id}" est supérieure au maximum (${max}).`,
        level: "error"
      });
    }
  }
}

function collectMuxViolations(
  node: ClockBaseElement,
  elements: ClockBaseElement[],
  violations: ClockRuleViolation[]
): void {
  if (!isMuxType(node.type)) return;

  const inputs = Array.isArray(node.possible_Input) ? node.possible_Input : [];
  if (inputs.length === 0) {
    violations.push({
      code: "mux_no_input",
      nodeId: node.id,
      field: "possible_Input",
      message: `Le multiplexeur "${node.id}" doit déclarer une liste d'entrées possibles.`,
      level: "error"
    });
    return;
  }

  const seen = new Set<string>();
  for (const input of inputs) {
    const key = String(input.input_Id ?? "");
    if (!key) {
      violations.push({
        code: "mux_input_no_id",
        nodeId: node.id,
        field: "possible_Input",
        message: `Une entrée du multiplexeur "${node.id}" n'a pas d'identifiant.`,
        level: "error"
      });
      continue;
    }
    if (seen.has(key)) {
      violations.push({
        code: "mux_input_duplicate",
        nodeId: node.id,
        field: "possible_Input",
        message: `L'entrée "${input.input_Id}" est déclarée deux fois dans le multiplexeur "${node.id}".`,
        level: "error"
      });
    }
    seen.add(key);
  }

  const selected = node.muxState?.selectedInputId ?? node.value ?? node.default;
  if (selected === undefined || selected === null || !seen.has(String(selected))) {
    violations.push({
      code: "mux_default_invalid",
      nodeId: node.id,
      field: "possible_Input",
      message: `L'entrée par défaut "${selected ?? "(vide)"}" du multiplexeur "${node.id}" doit désigner une entrée existante.`,
      level: "error"
    });
  }

  // Existence des sources référencées : entrée reliée par une transition.
  const elementIds = new Set(elements.map((element) => element.id));
  for (const input of inputs) {
    if (!input.from || typeof input.from !== "string") continue;
    if (elementIds.has(normalizeRef(input.from))) continue;
    // Une source libre (libellé de domaine d'horloge, ex. « HSI ») n'est pas
    // un identifiant de bloc : elle n'est vérifiée que si elle porte un
    // préfixe de port normalisé.
    if (!(input.from.startsWith("_output") || input.from.endsWith("_output") || input.from.includes("__"))) continue;
    violations.push({
      code: "mux_source_missing",
      nodeId: node.id,
      field: "possible_Input",
      message: `L'entrée "${input.input_Id}" du multiplexeur "${node.id}" référence une source inexistante "${input.from}".`,
      level: "warn"
    });
  }
}

/**
 * Règles métier matériel (§9 / §3.5) : bloc matériel et rôle conjoints,
 * cohérence de sécurité, validité des liens orphelins.
 */
function collectHardwareViolations(node: ClockBaseElement, violations: ClockRuleViolation[]): void {
  const block = String(node.block ?? "").trim();
  const role = String(node.role ?? "").trim();
  if (Boolean(block) !== Boolean(role)) {
    violations.push({
      code: "block_role_mismatch",
      nodeId: node.id,
      field: block ? "role" : "block",
      message: `Le bloc matériel et le rôle doivent être renseignés ensemble pour "${node.id}".`,
      level: "warn"
    });
  }

  // Cohérence des informations de sécurité (§9) : une zone de confiance doit
  // être rattachée à un contexte matériel complet.
  if (node.isTrustZone === true && (block === "" || role === "")) {
    violations.push({
      code: "security_trustzone_incomplete",
      nodeId: node.id,
      field: "block",
      message: `Le bloc "${node.id}" est marqué comme sécurisé (zone de confiance) mais les informations de bloc matériel et de rôle sont incomplètes.`,
      level: "warn"
    });
  }

  const orphanLink = node.orphanLink;
  if (orphanLink?.isOrphan && !String(orphanLink.label ?? "").trim()) {
    violations.push({
      code: "orphan_label_missing",
      nodeId: node.id,
      field: "orphanLink",
      message: `Le lien orphelin du bloc "${node.id}" doit posséder un libellé.`,
      level: "error"
    });
  }
  if (orphanLink && !orphanLink.isOrphan && String(orphanLink.label ?? "").trim()) {
    violations.push({
      code: "orphan_flag_mismatch",
      nodeId: node.id,
      field: "orphanLink",
      message: `Le bloc "${node.id}" a un libellé de lien orphelin alors que son état n'est pas « orphelin ».`,
      level: "warn"
    });
  }
}

/**
 * Normalise une référence (supprime suffixes `__...`, `_output`, `_input`).
 */
export function normalizeRef(reference: string | undefined | null): string {
  return String(reference ?? "")
    .replace(/__.*$/, "")
    .replace(/_output$/, "")
    .replace(/_input$/, "");
}