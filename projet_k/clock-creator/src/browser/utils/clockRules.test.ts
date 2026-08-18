import { ClockTreeFile, ClockBaseElement } from "../types/clock";
import { collectProjectDiagnostics } from "./clockDiagnostics";
import { validateConnection, reconcileOutputTargets, buildTransition } from "./clockConnections";

function baseProject(overrides: Partial<ClockTreeFile["tree"]> = {}): ClockTreeFile {
  return {
    master_clock_version: "1.0.0",
    copyright: "Test",
    version: "1.0.0",
    tree: {
      id: "test-tree",
      schema_version: "1.0.0",
      elements: [],
      transitions: [],
      ...overrides
    }
  };
}

function element(partial: Partial<ClockBaseElement> & { id: string }): ClockBaseElement {
  return {
    type: "editableValue",
    kind: "editableValue",
    position: { x: 0, y: 0 },
    outputTargets: [],
    ...partial
  };
}

function levels(diagnostics: { level: string }[]): Record<string, number> {
  return diagnostics.reduce((acc, diagnostic) => {
    acc[diagnostic.level] = (acc[diagnostic.level] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);
}

function errorsOf(diagnostics: { level: string; message: string }[]) {
  return diagnostics.filter((d) => d.level === "error").map((d) => d.message);
}

describe("clockRules: valeurs et plages (§6.2 / §6.4)", () => {
  it("refuse un minimum supérieur au maximum", () => {
    const project = baseProject({
      elements: [element({ id: "src", type: "variableSource", min: 100, max: 10, default: 50, value: 50 })]
    });
    const messages = errorsOf(collectProjectDiagnostics(project));
    expect(messages.some((m) => m.includes("minimum"))).toBe(true);
  });

  it("exige une valeur par défaut dans la plage", () => {
    const project = baseProject({
      elements: [element({ id: "src", type: "variableSource", min: 10, max: 20, default: 50, value: 50 })]
    });
    const messages = errorsOf(collectProjectDiagnostics(project));
    expect(messages.some((m) => m.includes("50") && m.includes("supérieure"))).toBe(true);
  });

  it("refuse un coefficient de diviseur non strictement positif", () => {
    const project = baseProject({
      elements: [element({ id: "div", type: "divider", default: 0, value: 0 })]
    });
    const messages = errorsOf(collectProjectDiagnostics(project));
    expect(messages.some((m) => m.includes("strictement positif"))).toBe(true);
  });
});

describe("clockRules: sources discrètes (§6.3)", () => {
  it("signale les valeurs dupliquées et une valeur par défaut hors liste", () => {
    const project = baseProject({
      elements: [
        element({
          id: "disc",
          type: "discreteSource",
          oneOf: [{ const: 1 }, { const: 1 }, { const: 2 }],
          default: 3,
          value: 3
        })
      ]
    });
    const messages = errorsOf(collectProjectDiagnostics(project));
    expect(messages.some((m) => m.includes("plusieurs fois"))).toBe(true);
    expect(messages.some((m) => m.includes("aucun choix autorisé"))).toBe(true);
  });
});

describe("clockRules: multiplexeur (§6.8 / §9)", () => {
  it("signale une liste d'entrées absente", () => {
    const project = baseProject({
      elements: [element({ id: "mux", type: "multiplexer", possible_Input: undefined })]
    });
    const messages = errorsOf(collectProjectDiagnostics(project));
    expect(messages.some((m) => m.includes("liste d'entrées possibles"))).toBe(true);
  });

  it("signale des entrées dupliquées et une entrée par défaut invalide", () => {
    const project = baseProject({
      elements: [
        element({
          id: "mux",
          type: "multiplexer",
          possible_Input: [
            { label: "A", available: true, input_Id: "a", from: "", isLocked: false, sourceDisabled: false },
            { label: "B", available: true, input_Id: "a", from: "", isLocked: false, sourceDisabled: false }
          ],
          default: "zzz",
          value: "zzz"
        })
      ]
    });
    const messages = errorsOf(collectProjectDiagnostics(project));
    expect(messages.some((m) => m.includes("deux fois"))).toBe(true);
    expect(messages.some((m) => m.includes("entrée existante"))).toBe(true);
  });

  it("ne produit pas d'erreur pour un multiplexeur valide", () => {
    const project = baseProject({
      elements: [
        element({
          id: "mux",
          type: "multiplexer",
          possible_Input: [
            { label: "A", available: true, input_Id: "a", from: "LSI", isLocked: false, sourceDisabled: false }
          ],
          default: "a",
          value: "a"
        })
      ]
    });
    expect(errorsOf(collectProjectDiagnostics(project))).toHaveLength(0);
  });
});

describe("clockRules: métier matériel (§9)", () => {
  it("exige la présence conjointe du bloc et du rôle", () => {
    const project = baseProject({
      elements: [element({ id: "n", type: "divider", block: "RCC" })]
    });
    const warns = levels(collectProjectDiagnostics(project)).warn ?? 0;
    expect(warns).toBeGreaterThan(0);
  });

  it("exige un libellé pour un lien orphelin", () => {
    const project = baseProject({
      elements: [element({ id: "n", type: "editableValue", orphanLink: { label: "", isOrphan: true } })]
    });
    const messages = errorsOf(collectProjectDiagnostics(project));
    expect(messages.some((m) => m.includes("libellé"))).toBe(true);
  });
});

describe("clockDiagnostics: structure et références (§9)", () => {
  it("signale l'absence des versions et de la racine", () => {
    const diagnostics = collectProjectDiagnostics({
      tree: { elements: [], transitions: [] }
    } as unknown as ClockTreeFile);
    const messages = errorsOf(diagnostics);
    expect(messages.some((m) => m.includes("version générale"))).toBe(true);
    expect(messages.some((m) => m.includes("identifiant de l'arbre"))).toBe(true);
  });

  it("signale une source et une cible inexistantes", () => {
    const project = baseProject({
      elements: [element({ id: "a" })],
      transitions: [{ id: "e", sourceTaskId: "ghost", targetTaskId: "a", isVirtual: false }]
    });
    const diagnostics = errorsOf(collectProjectDiagnostics(project));
    expect(diagnostics.some((m) => m.includes("source inexistante"))).toBe(true);
    expect(diagnostics.some((m) => m.includes("cible inexistante"))).toBe(false);
  });

  it("détecte une boucle d'horloge (cycle)", () => {
    const project = baseProject({
      elements: [element({ id: "a" }), element({ id: "b" })],
      transitions: [
        { id: "e1", sourceTaskId: "a", targetTaskId: "b", isVirtual: false },
        { id: "e2", sourceTaskId: "b", targetTaskId: "a", isVirtual: false }
      ]
    });
    const messages = errorsOf(collectProjectDiagnostics(project));
    expect(messages.some((m) => m.includes("cycle") || m.includes("boucle"))).toBe(true);
  });

  it("garantit la cohérence entre connexions et destinataires", () => {
    const project = baseProject({
      elements: [
        element({ id: "a", outputTargets: ["b"] }),
        element({ id: "b", outputTargets: [] })
      ],
      transitions: [{ id: "e1", sourceTaskId: "a", targetTaskId: "b", isVirtual: false }]
    });
    const diagnostics = collectProjectDiagnostics(project);
    expect(diagnostics.some((d) => d.level === "error" && d.message.includes("destinataire"))).toBe(false);

    const incoherent = baseProject({
      elements: [element({ id: "a", outputTargets: [] }), element({ id: "b" })],
      transitions: [{ id: "e1", sourceTaskId: "a", targetTaskId: "b", isVirtual: false }]
    });
    const messages = errorsOf(collectProjectDiagnostics(incoherent));
    expect(messages.some((m) => m.includes("ne le déclare pas"))).toBe(true);
  });
});

describe("clockConnections: gestion des connexions (§7)", () => {
  const project = baseProject({
    elements: [
      element({ id: "src", type: "editableValue" }),
      element({ id: "div", type: "divider" }),
      element({ id: "mux", type: "multiplexer", possible_Input: [
        { label: "A", available: true, input_Id: "a", from: "", isLocked: false, sourceDisabled: false }
      ] })
    ]
  });

  it("exige une source et une cible existantes", () => {
    expect(validateConnection(project, { sourceTaskId: "src", targetTaskId: "ghost" }).ok).toBe(false);
    expect(validateConnection(project, { sourceTaskId: "ghost", targetTaskId: "div" }).ok).toBe(false);
  });

  it("interdit l'auto-connexion", () => {
    expect(validateConnection(project, { sourceTaskId: "src", targetTaskId: "src" }).ok).toBe(false);
  });

  it("refuse une connexion identique déjà existante", () => {
    const withEdge = baseProject({
      elements: project.tree.elements,
      transitions: [{ id: "e1", sourceTaskId: "src", targetTaskId: "div", isVirtual: false }]
    });
    const result = validateConnection(withEdge, { sourceTaskId: "src", targetTaskId: "div" });
    expect(result.ok).toBe(false);
    expect(result.error).toContain("identique");
  });

  it("refuse un port d'entrée non déclaré sur un multiplexeur", () => {
    const result = validateConnection(project, { sourceTaskId: "src", targetTaskId: "mux", targetPortId: "mux__zzz" });
    expect(result.ok).toBe(false);
  });

  it("détecte la création d'un cycle", () => {
    const cyclic = baseProject({
      elements: project.tree.elements,
      transitions: [
        { id: "e1", sourceTaskId: "src", targetTaskId: "div", isVirtual: false },
        { id: "e2", sourceTaskId: "div", targetTaskId: "mux", isVirtual: false }
      ]
    });
    const result = validateConnection(cyclic, { sourceTaskId: "mux", targetTaskId: "src" });
    expect(result.ok).toBe(false);
    expect(result.error).toContain("cycle");
  });
});

describe("clockConnections: destinataires (§7)", () => {
  it("synchronise outputTargets avec les connexions", () => {
    const elements = [
      element({ id: "a", outputTargets: ["old", "c"] }),
      element({ id: "b", outputTargets: [] })
    ];
    const reconciled = reconcileOutputTargets(elements, [
      { id: "e1", sourceTaskId: "a", targetTaskId: "b", isVirtual: false }
    ]);
    expect(reconciled[0].outputTargets).toEqual(["b"]);
  });

  it("construit une transition valide", () => {
    const project = baseProject({
      elements: [
        element({ id: "a", position: { x: 0, y: 0 } }),
        element({ id: "b", position: { x: 100, y: 0 } })
      ]
    });
    const transition = buildTransition(project, { sourceTaskId: "a", targetTaskId: "b" });
    expect(transition.sourceTaskId).toBe("a");
    expect(transition.targetTaskId).toBe("b");
    expect(transition.isVirtual).toBe(false);
    expect(transition.id).toContain("edge_a_b");
  });
});