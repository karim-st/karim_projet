import { useEffect, useMemo, useState } from "react";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import type { ClockBaseElement, ClockDiagnostic, ClockInputOption } from "../../types/clock";

type PropertiesFormProps = {
  node: ClockBaseElement;
  onChange: (updatedNode: ClockBaseElement) => void;
  errors?: ClockDiagnostic[];
};

function labelToText(label: ClockBaseElement["label"]): string {
  if (typeof label === "string") return label;
  return label?.text ?? "";
}

function makeLabel(text: string, align: "top" | "right" | "left" | "bottom" = "top") {
  return { align, text };
}

function typeString(type: string | undefined): string {
  return String(type ?? "").toLowerCase();
}

function optionalNumber(value: string): number | undefined {
  if (value.trim() === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function PropertiesForm({ node, onChange, errors = [] }: PropertiesFormProps) {
  const [localNode, setLocalNode] = useState<ClockBaseElement>(node);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    setLocalNode(node);
    setIsDirty(false);
  }, [node]);

  const type = localNode.type;
  const labelTextValue = useMemo(() => labelToText(localNode.label), [localNode.label]);
  const unitText = localNode.unit?.text ?? "";
  const errorFields = useMemo(
    () => new Set(errors.map((error) => error.field).filter(Boolean) as string[]),
    [errors]
  );

  const fieldError = (field: string) =>
    errorFields.has(field)
      ? (errors.find((error) => error.field === field)?.message ?? "")
      : "";

  const updateField = <K extends keyof ClockBaseElement>(
    key: K,
    value: ClockBaseElement[K]
  ) => {
    setLocalNode((current) => ({ ...current, [key]: value }));
    setIsDirty(true);
  };

  const updateLabel = (value: string) => {
    const currentAlign =
      typeof localNode.label === "object" && localNode.label?.align
        ? localNode.label.align
        : "top";

    updateField("label", makeLabel(value, currentAlign));
  };

  const updateInputs = (inputs: ClockInputOption[]) => {
    updateField("possible_Input", inputs);
  };

  const normalizedType = typeString(type);
  const hasRange = ["variablesource", "editablevalue", "variablesourcevalue"].includes(normalizedType);
  const isDiscrete = ["discretesource", "discretevalue"].includes(normalizedType);
  const isFactor = ["divider", "multiplier"].includes(normalizedType);
  const isFractional = ["fractionalvalue", "fractional"].includes(normalizedType);
  const isMux = ["mux", "multiplexer", "multiplexor"].includes(normalizedType);
  const isGroup = ["group", "rectangle", "rectangleshape"].includes(normalizedType);
  const isAnnotationShape = ["annotationrectangle", "annotationsquare", "annotationcircle"].includes(normalizedType);

  const muxInputs = localNode.possible_Input ?? [];
  const choices = localNode.oneOf ?? [];

  const addMuxInput = () => {
    const inputId = `input_${Date.now()}`;
    updateInputs([
      ...muxInputs,
      {
        label: `Entrée ${muxInputs.length + 1}`,
        available: true,
        input_Id: inputId,
        from: "",
        isLocked: false,
        sourceDisabled: false
      }
    ]);
  };

  const updateMuxInput = (index: number, patch: Partial<ClockInputOption>) => {
    updateInputs(muxInputs.map((input, i) => (i === index ? { ...input, ...patch } : input)));
  };

  const removeMuxInput = (index: number) => {
    const next = muxInputs.filter((_, i) => i !== index);
    updateInputs(next);
    const removedId = muxInputs[index]?.input_Id;
    if (removedId && (localNode.default === removedId || localNode.value === removedId)) {
      const fallback = next[0]?.input_Id ?? "";
      setLocalNode((current) => ({ ...current, default: fallback, value: fallback }));
    }
  };

  const addChoice = () => {
    updateField("oneOf", [...choices, { const: 1 }]);
  };

  const updateChoice = (index: number, patch: Partial<{ const: number | string }>) => {
    updateField(
      "oneOf",
      choices.map((choice, i) => (i === index ? { ...choice, ...patch } : choice))
    );
  };

  const removeChoice = (index: number) => {
    const next = choices.filter((_, i) => i !== index);
    updateField("oneOf", next);
    const removed = choices[index];
    if (removed !== undefined && `${localNode.default}` === `${removed.const}`) {
      setLocalNode((current) => ({ ...current, default: "", value: "" }));
    }
  };

  const errorBlock = (field: string) => {
    const message = fieldError(field);
    if (!message) return null;
    return (
      <p className="mt-1 text-[11px] text-red-600" role="alert">
        {message}
      </p>
    );
  };

  return (
    <div className="space-y-5">
      {errors.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3">
          <p className="text-xs font-semibold text-red-700">
            {errors.filter((error) => error.level === "error").length} erreur(s),{" "}
            {errors.filter((error) => error.level === "warn").length} avertissement(s)
          </p>
          <ul className="mt-1 space-y-1">
            {errors.slice(0, 5).map((error) => (
              <li key={error.id} className="text-[11px] text-red-600">
                {error.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      <section>
        <h4 className="mb-2 text-[11px] font-bold uppercase tracking-wide text-gray-400 dark:text-slate-500">Identité</h4>
        <div className="space-y-3">
          <div>
            <label htmlFor={`node-id-${localNode.id}`} className="text-xs font-semibold text-gray-600 dark:text-slate-300">Identifiant (clé métier)</label>
            <Input id={`node-id-${localNode.id}`} className={`mt-1 ${errorFields.has("id") ? "border-red-400" : ""}`} value={localNode.id} onChange={(event) => updateField("id", event.target.value)} />
            {errorBlock("id")}
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-600 dark:text-slate-300">Libellé</label>
            <Input className="mt-1" value={labelTextValue} onChange={(e) => updateLabel(e.target.value)} />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-600 dark:text-slate-300">Alignement du libellé</label>
            <select
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 outline-none dark:border-slate-600 dark:bg-[#0f1a2a] dark:text-slate-100"
              value={typeof localNode.label === "object" && localNode.label?.align ? localNode.label.align : "top"}
              onChange={(e) => updateField("label", makeLabel(labelTextValue, e.target.value as "top" | "right" | "left" | "bottom"))}
            >
              <option value="top">Haut</option>
              <option value="right">Droite</option>
              <option value="left">Gauche</option>
              <option value="bottom">Bas</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-600 dark:text-slate-300">Type</label>
            <Input className="mt-1" value={type} disabled />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-600 dark:text-slate-300">Description</label>
            <textarea
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#17146E] focus:ring-2 focus:ring-[#17146E]/20 dark:border-slate-600 dark:bg-[#0f1a2a] dark:text-slate-100"
              rows={3}
              value={String(localNode.description ?? "")}
              onChange={(e) => updateField("description", e.target.value)}
            />
          </div>
        </div>
      </section>

      <section>
        <h4 className="mb-2 text-[11px] font-bold uppercase tracking-wide text-gray-400 dark:text-slate-500">Configuration</h4>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-gray-600 dark:text-slate-300">Valeur par défaut</label>
            <Input className={`mt-1 ${errorFields.has("default") ? "border-red-400" : ""}`} value={String(localNode.default ?? "")} onChange={(e) => updateField("default", e.target.value)} />
            {errorBlock("default")}
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 dark:text-slate-300">Valeur courante</label>
            <Input className={`mt-1 ${errorFields.has("value") ? "border-red-400" : ""}`} value={String(localNode.value ?? "")} onChange={(e) => updateField("value", e.target.value)} />
            {errorBlock("value")}
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 dark:text-slate-300">Unité</label>
            <Input className="mt-1" value={unitText} onChange={(e) => updateField("unit", { ...(localNode.unit ?? {}), text: e.target.value })} />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 dark:text-slate-300">Fréquence calculée</label>
            <Input className="mt-1" value={localNode.computedValue !== undefined && localNode.computedValue !== "" ? `${localNode.computedValue}` : ""} readOnly />
          </div>
        </div>

        {(hasRange || isFactor) && (
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-600 dark:text-slate-300">Minimum</label>
              <Input className={`mt-1 ${errorFields.has("min") ? "border-red-400" : ""}`} type="number" value={localNode.min ?? ""} onChange={(e) => updateField("min", optionalNumber(e.target.value))} />
              {errorBlock("min")}
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 dark:text-slate-300">Maximum</label>
              <Input className={`mt-1 ${errorFields.has("max") ? "border-red-400" : ""}`} type="number" value={localNode.max ?? ""} onChange={(e) => updateField("max", optionalNumber(e.target.value))} />
              {errorBlock("max")}
            </div>
          </div>
        )}

        {isDiscrete && (
          <div className="mt-3">
            <div className="mb-1 flex items-center justify-between">
              <label className="text-xs font-semibold text-gray-600 dark:text-slate-300">Choix autorisés</label>
            </div>
            <div className={`space-y-1 ${errorFields.has("oneOf") ? "rounded-lg border border-red-400 p-2" : ""}`}>
              {choices.map((choice, index) => (
                <div key={`${choice.const}-${index}`} className="grid grid-cols-[1fr_1.4fr_auto] items-center gap-2">
                  <Input
                    type="number"
                    value={String(choice.const ?? "")}
                    aria-label={`Valeur du choix ${index + 1}`}
                    onChange={(e) => updateChoice(index, { const: optionalNumber(e.target.value) ?? e.target.value })}
                  />
                  <Input
                    value={String((choice as { title?: string }).title ?? "")}
                    aria-label={`Titre du choix ${index + 1}`}
                    placeholder="Titre affiché"
                    onChange={(e) =>
                      updateChoice(
                        index,
                        { ...choice, title: e.target.value } as Partial<{ const: number | string }>
                      )
                    }
                  />
                  <button
                    type="button"
                    className="rounded p-1.5 text-gray-400 dark:text-slate-500 hover:bg-red-50 hover:text-red-600"
                    aria-label={`Supprimer le choix ${index + 1}`}
                    title="Supprimer ce choix"
                    onClick={() => removeChoice(index)}
                  >
                    ✕
                  </button>
                </div>
              ))}
              {choices.length === 0 && (
                <p className="rounded border border-dashed border-gray-300 p-2 text-[11px] text-gray-500 dark:border-slate-600 dark:text-slate-400">
                  Aucun choix autorisé.
                </p>
              )}
            </div>
            {errorBlock("oneOf")}
            <button
              type="button"
              className="mt-2 rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-[#17146E] hover:bg-gray-50 dark:border-slate-600 dark:hover:bg-slate-800"
              onClick={addChoice}
            >
              + Ajouter un choix
            </button>
          </div>
        )}

        {isFactor && (
          <div className="mt-3">
            <label className="text-xs font-semibold text-gray-600 dark:text-slate-300">Coefficients autorisés (un par ligne)</label>
            <textarea
              className={`mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#17146E] focus:ring-2 focus:ring-[#17146E]/20 ${errorFields.has("oneOf") ? "border-red-400" : ""}`}
              rows={4}
              value={choices.map((choice) => String(choice.const)).join("\n")}
              onChange={(e) =>
                updateField(
                  "oneOf",
                  e.target.value.split("\n").map((value) => value.trim()).filter(Boolean).map((value) => ({ const: Number.isNaN(Number(value)) ? value : Number(value) }))
                )
              }
            />
            {errorBlock("oneOf")}
          </div>
        )}

        {isFractional && (
          <div className="mt-3 grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-600 dark:text-slate-300">Base</label>
              <Input className={`mt-1 ${errorFields.has("base") ? "border-red-400" : ""}`} type="number" value={String(localNode.base ?? "")} onChange={(e) => updateField("base", optionalNumber(e.target.value))} />
              {errorBlock("base")}
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 dark:text-slate-300">Puissance</label>
              <Input className={`mt-1 ${errorFields.has("power") ? "border-red-400" : ""}`} type="number" value={String(localNode.power ?? "")} onChange={(e) => updateField("power", optionalNumber(e.target.value))} />
              {errorBlock("power")}
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 dark:text-slate-300">Facteur</label>
              <Input className={`mt-1 ${errorFields.has("factor") ? "border-red-400" : ""}`} type="number" value={String(localNode.factor ?? "")} onChange={(e) => updateField("factor", optionalNumber(e.target.value))} />
              {errorBlock("factor")}
            </div>
          </div>
        )}
      </section>

      {isMux && (
        <section>
          <h4 className="mb-2 text-[11px] font-bold uppercase tracking-wide text-gray-400 dark:text-slate-500">Entrées du multiplexeur</h4>
          <div className={`space-y-2 ${errorFields.has("possible_Input") ? "rounded-lg border border-red-400 p-2" : ""}`}>
            {muxInputs.map((input, index) => (
              <div key={input.input_Id + index} className="rounded-md border border-gray-200 bg-gray-50 p-2 dark:border-slate-700 dark:bg-slate-800">
                <div className="grid grid-cols-[1fr_1.4fr_auto] items-center gap-2">
                  <Input
                    value={String(input.input_Id)}
                    aria-label={`Identifiant de l'entrée ${index + 1}`}
                    onChange={(e) => updateMuxInput(index, { input_Id: e.target.value })}
                  />
                  <Input
                    value={String(input.label)}
                    aria-label={`Libellé de l'entrée ${index + 1}`}
                    onChange={(e) => updateMuxInput(index, { label: e.target.value })}
                  />
                  <button
                    type="button"
                    className="rounded p-1.5 text-gray-400 dark:text-slate-500 hover:bg-red-50 hover:text-red-600"
                    aria-label={`Supprimer l'entrée ${index + 1}`}
                    title="Supprimer cette entrée (sa connexion est également retirée)"
                    onClick={() => removeMuxInput(index)}
                  >
                    ✕
                  </button>
                </div>
                <textarea
                  className="mt-1 w-full rounded-md border border-gray-200 px-2 py-1 text-[11px] outline-none"
                  rows={1}
                  value={String(input.description ?? "")}
                  placeholder="Description"
                  aria-label={`Description de l'entrée ${index + 1}`}
                  onChange={(e) => updateMuxInput(index, { description: e.target.value })}
                />
                <label className="mt-1 flex items-center gap-2 text-[11px] text-gray-600 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={Boolean(input.available)}
                    onChange={(e) => updateMuxInput(index, { available: e.target.checked })}
                  />
                  Entrée disponible
                </label>
              </div>
            ))}
            {muxInputs.length === 0 && (
              <p className="rounded border border-dashed border-gray-300 p-2 text-[11px] text-gray-500 dark:border-slate-600 dark:text-slate-400">
                Aucune entrée possible.
              </p>
            )}
          </div>
          {errorBlock("possible_Input")}
          <div className="mt-2 flex items-end gap-2">
            <Button type="button" variant="secondary" className="px-3 py-1.5 text-xs" onClick={addMuxInput}>
              + Ajouter une entrée
            </Button>
            {muxInputs.length > 0 && (
              <div className="flex-1">
                <label className="text-xs font-semibold text-gray-600 dark:text-slate-300">Entrée par défaut</label>
                <select
                  className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 outline-none dark:border-slate-600 dark:bg-[#0f1a2a] dark:text-slate-100"
                  value={String(localNode.default ?? "")}
                  onChange={(e) => {
                    const nextId = e.target.value;
                    updateField("default", nextId);
                    updateField("value", nextId);
                  }}
                >
                  {muxInputs.map((input) => (
                    <option key={input.input_Id} value={input.input_Id}>
                      {input.label || input.input_Id}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </section>
      )}

      <section>
        <h4 className="mb-2 text-[11px] font-bold uppercase tracking-wide text-gray-400 dark:text-slate-500">Connexions</h4>
        <div>
          <label className="text-xs font-semibold text-gray-600 dark:text-slate-300">Destinataires (sorties)</label>
          <textarea
            className={`mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#17146E] focus:ring-2 focus:ring-[#17146E]/20 ${errorFields.has("outputTargets") ? "border-red-400" : ""}`}
            rows={3}
            value={(localNode.outputTargets ?? []).join(", ")}
            onChange={(e) =>
              updateField(
                "outputTargets",
                e.target.value
                  .split(",")
                  .map((v) => v.trim())
                  .filter(Boolean)
              )
            }
          />
          {errorBlock("outputTargets")}
          <p className="mt-1 text-[10px] text-gray-400 dark:text-slate-500">
            Synchronisé automatiquement avec les connexions du diagramme.
          </p>
        </div>
      </section>

      <section>
        <h4 className="mb-2 text-[11px] font-bold uppercase tracking-wide text-gray-400 dark:text-slate-500">Métier</h4>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-gray-600 dark:text-slate-300">Bloc matériel</label>
            <Input className={`mt-1 ${errorFields.has("block") ? "border-red-400" : ""}`} value={String(localNode.block ?? "")} onChange={(e) => updateField("block", e.target.value)} />
            {errorBlock("block")}
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 dark:text-slate-300">Rôle</label>
            <Input className={`mt-1 ${errorFields.has("role") ? "border-red-400" : ""}`} value={String(localNode.role ?? "")} onChange={(e) => updateField("role", e.target.value)} />
            {errorBlock("role")}
          </div>
        </div>

        {localNode.clocked_instance !== undefined && localNode.clocked_instance !== null && (
          <div className="mt-3">
            <label className="text-xs font-semibold text-gray-600 dark:text-slate-300">Instances alimentées</label>
            <textarea
              className="mt-1 w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-600 dark:text-slate-300 dark:border-slate-600 dark:bg-slate-800"
              rows={2}
              readOnly
              value={Array.isArray(localNode.clocked_instance) ? localNode.clocked_instance.join(", ") : JSON.stringify(localNode.clocked_instance)}
            />
          </div>
        )}

        <div className="mt-3 grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-gray-600 dark:text-slate-300">Position X</label>
            <Input type="number" className="mt-1" value={localNode.position.x} onChange={(e) => updateField("position", { ...localNode.position, x: Number(e.target.value) })} />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 dark:text-slate-300">Position Y</label>
            <Input type="number" className="mt-1" value={localNode.position.y} onChange={(e) => updateField("position", { ...localNode.position, y: Number(e.target.value) })} />
          </div>
        </div>
      </section>

      <section>
        <h4 className="mb-2 text-[11px] font-bold uppercase tracking-wide text-gray-400 dark:text-slate-500">Sécurité et liens</h4>
        <div className="grid grid-cols-[1fr_auto] items-end gap-3">
          <div>
            <label className="text-xs font-semibold text-gray-600 dark:text-slate-300">Libellé du lien orphelin</label>
            <Input className={`mt-1 ${errorFields.has("orphanLink") ? "border-red-400" : ""}`} value={localNode.orphanLink?.label ?? ""} onChange={(e) => updateField("orphanLink", { label: e.target.value, isOrphan: localNode.orphanLink?.isOrphan ?? false })} />
            {errorBlock("orphanLink")}
          </div>
          <label className="flex items-center gap-2 pb-2 text-xs font-semibold text-gray-600 dark:text-slate-300">
            <input type="checkbox" checked={Boolean(localNode.orphanLink?.isOrphan)} onChange={(e) => updateField("orphanLink", { label: localNode.orphanLink?.label ?? "", isOrphan: e.target.checked })} />
            Orphelin
          </label>
        </div>
        <label className="mt-2 flex items-center gap-2 text-xs font-semibold text-gray-600 dark:text-slate-300">
          <input type="checkbox" checked={Boolean(localNode.isTrustZone)} onChange={(e) => updateField("isTrustZone", e.target.checked)} />
          Donnée sécurisée (zone de confiance)
        </label>
      </section>

      {(isGroup || isAnnotationShape) && (
        <section>
          <h4 className="mb-2 text-[11px] font-bold uppercase tracking-wide text-gray-400 dark:text-slate-500">Géométrie</h4>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-600 dark:text-slate-300">Largeur</label>
              <Input type="number" className="mt-1" value={localNode.size?.width ?? 320} onChange={(e) => updateField("size", { width: Number(e.target.value), height: localNode.size?.height ?? 180 })} />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 dark:text-slate-300">Hauteur</label>
              <Input type="number" className="mt-1" value={localNode.size?.height ?? 180} onChange={(e) => updateField("size", { width: localNode.size?.width ?? 320, height: Number(e.target.value) })} />
            </div>
          </div>
        </section>
      )}

      <Button
        className="w-full"
        disabled={!isDirty}
        onClick={() => {
          onChange(localNode);
          setIsDirty(false);
        }}
      >
        Enregistrer les modifications
      </Button>
    </div>
  );
}