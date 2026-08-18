import { useEffect, useMemo, useState } from "react";
import { useClockStore } from "../../store/clockStore";
import { toast } from "sonner";
import { Card } from "../ui/Card";
import { Input } from "../ui/Input";
import { PropertiesForm } from "../forms/PropertiesForm";
import type { ClockTransition, ClockTransitionLineStyle } from "../../types/clock";

function EdgePropertiesForm({ edge }: { edge: ClockTransition }) {
  const updateEdge = useClockStore((s) => s.updateEdge);
  const updates = (patch: Partial<ClockTransition>) => updateEdge(edge.id, patch);

  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs font-semibold text-gray-600 dark:text-slate-300">Libellé de départ</label>
        <Input
          className="mt-1"
          value={edge.startLabel ?? ""}
          onChange={(event) => updates({ startLabel: event.target.value })}
        />
      </div>
      <div>
        <label className="text-xs font-semibold text-gray-600 dark:text-slate-300">Libellé d'arrivée</label>
        <Input
          className="mt-1"
          value={edge.endLabel ?? ""}
          onChange={(event) => updates({ endLabel: event.target.value })}
        />
      </div>
      <div>
        <label className="text-xs font-semibold text-gray-600 dark:text-slate-300">Style de ligne</label>
        <select
          className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 dark:text-slate-100 outline-none dark:border-slate-600 dark:bg-[#0f1a2a]"
          value={edge.lineStyle ?? "normal"}
          onChange={(event) => updates({ lineStyle: event.target.value as ClockTransitionLineStyle })}
        >
          <option value="normal">Normale</option>
          <option value="dashed">Découpée</option>
          <option value="bold">Grasse</option>
        </select>
      </div>
      <label className="flex items-center gap-2 text-xs font-semibold text-gray-600 dark:text-slate-300">
        <input
          type="checkbox"
          checked={Boolean(edge.isVirtual)}
          onChange={(event) => updates({ isVirtual: event.target.checked })}
        />
        Connexion virtuelle
      </label>
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-2 text-[11px] text-gray-600 dark:text-slate-300 dark:border-slate-700 dark:bg-slate-800">
        <p><span className="font-semibold">Source :</span> {edge.sourceTaskId}</p>
        <p><span className="font-semibold">Cible :</span> {edge.targetTaskId}</p>
        {edge.targetPortId && <p><span className="font-semibold">Port :</span> {edge.targetPortId}</p>}
      </div>
    </div>
  );
}

function EdgeSelectionPanel({ edgeId }: { edgeId: string }) {
  const edge = useClockStore((s) =>
    s.project.tree.transitions.find((transition) => transition.id === edgeId) ?? null
  );
  const diagnostics = useClockStore((s) => s.diagnostics);

  const edgeDiagnostics = useMemo(
    () => diagnostics.filter((diagnostic) => String(diagnostic.nodeId ?? "") === "" && diagnostic.message.includes(`"${edgeId}"`)),
    [diagnostics, edgeId]
  );

  if (!edge) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 bg-white p-3 text-sm text-gray-500 dark:border-slate-600 dark:bg-[#151e2e] dark:text-slate-400">
        La connexion sélectionnée n'existe plus.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {edgeDiagnostics.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950/40">
          <ul className="space-y-1">
            {edgeDiagnostics.map((error) => (
              <li key={error.id} className="text-[11px] text-red-600 dark:text-red-400">
                {error.message}
              </li>
            ))}
          </ul>
        </div>
      )}
      <EdgePropertiesForm edge={edge} />
    </div>
  );
}

export function InfoPanel() {
  const selectedNode = useClockStore((s) => s.selectedNode);
  const updateNode = useClockStore((s) => s.updateNode);
  const renameNode = useClockStore((s) => s.renameNode);
  const diagnostics = useClockStore((s) => s.diagnostics);
  const project = useClockStore((s) => s.project);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);

  useEffect(() => {
    const handleEdgeSelect = (event: Event) => {
      setSelectedEdgeId((event as CustomEvent<string | null>).detail ?? null);
    };
    window.addEventListener("clock-edge-select", handleEdgeSelect);
    return () => window.removeEventListener("clock-edge-select", handleEdgeSelect);
  }, []);

  const nodeDiagnostics = useMemo(
    () =>
      selectedNode?.id
        ? diagnostics.filter((diagnostic) => diagnostic.nodeId === selectedNode.id)
        : [],
    [diagnostics, selectedNode]
  );

  return (
    <aside className="h-full w-full min-w-0 overflow-auto border-l border-gray-200 bg-white p-3 dark:border-slate-700 dark:bg-[#121c2b]">
      <div className="mb-2 text-[11px] uppercase tracking-wide text-gray-500 dark:text-slate-400">
        Clock Properties
      </div>

      <Card className="bg-gray-50 p-4 dark:bg-slate-800">
        <h3 className="text-lg font-bold text-gray-800 dark:text-slate-100">Clock Information</h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
          {selectedEdgeId
            ? "Modifier la connexion sélectionnée"
            : selectedNode
              ? "Modifier le bloc sélectionné"
              : "Modifier les paramètres du projet"}
        </p>

        <div className="mt-4 space-y-4">
          <div>
            <label className="text-xs font-semibold text-gray-600 dark:text-slate-300">Projet</label>
            <Input className="mt-1" value={project.tree.id} disabled />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-600 dark:text-slate-300">Version du schéma</label>
            <Input className="mt-1" value={project.tree.schema_version} disabled />
          </div>

          {selectedEdgeId ? (
            <EdgeSelectionPanel edgeId={selectedEdgeId} />
          ) : selectedNode ? (
            <>
              <PropertiesForm
                node={selectedNode}
                errors={nodeDiagnostics}
                onChange={(updatedNode) => {
                  const nextNodeId = updatedNode.id.trim();
                  if (!nextNodeId) {
                    toast.error("L'identifiant du bloc ne peut pas être vide.");
                    return;
                  }

                  if (
                    nextNodeId !== selectedNode.id &&
                    !renameNode(selectedNode.id, nextNodeId)
                  ) {
                    toast.error("L'identifiant du bloc doit être unique.");
                    return;
                  }

                  updateNode(nextNodeId, { ...updatedNode, id: nextNodeId });
                }}
              />
            </>
          ) : (
<div className="rounded-lg border border-dashed border-gray-300 bg-white p-3 text-sm text-gray-500 dark:text-slate-400 dark:border-slate-600 dark:bg-[#151e2e]">
              Sélectionnez un bloc ou une connexion dans le diagramme pour éditer ses propriétés.
            </div>
          )}
        </div>
      </Card>
    </aside>
  );
}