import { useEffect, useMemo, useState } from "react";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import type { ClockBaseElement } from "../../types/clock";

type PropertiesFormProps = {
  node: ClockBaseElement;
  onChange: (updatedNode: ClockBaseElement) => void;
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

export function PropertiesForm({ node, onChange }: PropertiesFormProps) {
  const [localNode, setLocalNode] = useState<ClockBaseElement>(node);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    setLocalNode(node);
    setIsDirty(false);
  }, [node]);

  const type = localNode.type;
  const labelTextValue = useMemo(() => labelToText(localNode.label), [localNode.label]);

  const unitText = localNode.unit?.text ?? "";

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

  const normalizedType = typeString(type);
  const hasRange = ["variablesource", "editablevalue", "variablesourcevalue"].includes(normalizedType);
  const isDiscrete = ["discretesource", "discretevalue"].includes(normalizedType);
  const isFactor = ["divider", "multiplier"].includes(normalizedType);
  const isFractional = ["fractionalvalue", "fractional"].includes(normalizedType);
  const isGroup = ["group", "rectangle", "rectangleshape"].includes(normalizedType);
  const isAnnotationShape = ["annotationrectangle", "annotationsquare", "annotationcircle"].includes(normalizedType);
  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs font-semibold text-gray-600">Node ID</label>
        <Input
          className="mt-1"
          value={localNode.id}
          onChange={(event) => updateField("id", event.target.value)}
        />
      </div>

      <div>
        <label className="text-xs font-semibold text-gray-600">Label</label>
        <Input className="mt-1" value={labelTextValue} onChange={(e) => updateLabel(e.target.value)} />
      </div>

      <div>
        <label className="text-xs font-semibold text-gray-600">Type</label>
        <Input className="mt-1" value={type} disabled />
      </div>

      <div>
        <label className="text-xs font-semibold text-gray-600">Description</label>
        <textarea
          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#17146E] focus:ring-2 focus:ring-[#17146E]/20"
          rows={3}
          value={String(localNode.description ?? "")}
          onChange={(e) => updateField("description", e.target.value)}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-semibold text-gray-600">Default Value</label>
          <Input className="mt-1" value={String(localNode.default ?? "")} onChange={(e) => updateField("default", e.target.value)} />
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-600">Current Value</label>
          <Input className="mt-1" value={String(localNode.value ?? "")} onChange={(e) => updateField("value", e.target.value)} />
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-600">Unit</label>
          <Input className="mt-1" value={unitText} onChange={(e) => updateField("unit", { ...(localNode.unit ?? {}), text: e.target.value })} />
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-600">Hardware Block</label>
          <Input className="mt-1" value={String(localNode.block ?? "")} onChange={(e) => updateField("block", e.target.value)} />
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-600">Role</label>
          <Input className="mt-1" value={String(localNode.role ?? "")} onChange={(e) => updateField("role", e.target.value)} />
        </div>
        <div className="flex items-end pb-2">
          <label className="flex items-center gap-2 text-xs font-semibold text-gray-600">
            <input type="checkbox" checked={Boolean(localNode.isTrustZone)} onChange={(e) => updateField("isTrustZone", e.target.checked)} />
            Security sensitive
          </label>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-semibold text-gray-600">Position X</label>
          <Input type="number" className="mt-1" value={localNode.position.x} onChange={(e) => updateField("position", { ...localNode.position, x: Number(e.target.value) })} />
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-600">Position Y</label>
          <Input type="number" className="mt-1" value={localNode.position.y} onChange={(e) => updateField("position", { ...localNode.position, y: Number(e.target.value) })} />
        </div>
      </div>

      <div className="grid grid-cols-[1fr_auto] items-end gap-3">
        <div>
          <label className="text-xs font-semibold text-gray-600">Orphan Link Label</label>
          <Input className="mt-1" value={localNode.orphanLink?.label ?? ""} onChange={(e) => updateField("orphanLink", { label: e.target.value, isOrphan: localNode.orphanLink?.isOrphan ?? false })} />
        </div>
        <label className="flex items-center gap-2 pb-2 text-xs font-semibold text-gray-600">
          <input type="checkbox" checked={Boolean(localNode.orphanLink?.isOrphan)} onChange={(e) => updateField("orphanLink", { label: localNode.orphanLink?.label ?? "", isOrphan: e.target.checked })} />
          Orphan
        </label>
      </div>

      {(hasRange || isFactor) && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-gray-600">Minimum</label>
            <Input type="number" className="mt-1" value={localNode.min ?? ""} onChange={(e) => updateField("min", optionalNumber(e.target.value))} />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600">Maximum</label>
            <Input type="number" className="mt-1" value={localNode.max ?? ""} onChange={(e) => updateField("max", optionalNumber(e.target.value))} />
          </div>
        </div>
      )}

      {(isDiscrete || isFactor) && (
        <div>
          <label className="text-xs font-semibold text-gray-600">Allowed Values (one per line)</label>
          <textarea
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#17146E] focus:ring-2 focus:ring-[#17146E]/20"
            rows={4}
            value={(localNode.oneOf ?? []).map((choice) => String(choice.const)).join("\n")}
            onChange={(e) => updateField("oneOf", e.target.value.split("\n").map((value) => value.trim()).filter(Boolean).map((value) => ({ const: Number.isNaN(Number(value)) ? value : Number(value) })))}
          />
        </div>
      )}

      {isFractional && (
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-xs font-semibold text-gray-600">Base</label>
            <Input type="number" className="mt-1" value={String(localNode.base ?? "")} onChange={(e) => updateField("base", optionalNumber(e.target.value))} />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600">Power</label>
            <Input type="number" className="mt-1" value={String(localNode.power ?? "")} onChange={(e) => updateField("power", optionalNumber(e.target.value))} />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600">Factor</label>
            <Input type="number" className="mt-1" value={String(localNode.factor ?? "")} onChange={(e) => updateField("factor", optionalNumber(e.target.value))} />
          </div>
        </div>
      )}

      {(isGroup || isAnnotationShape) && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-gray-600">Width</label>
            <Input type="number" className="mt-1" value={localNode.size?.width ?? 320} onChange={(e) => updateField("size", { width: Number(e.target.value), height: localNode.size?.height ?? 180 })} />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600">Height</label>
            <Input type="number" className="mt-1" value={localNode.size?.height ?? 180} onChange={(e) => updateField("size", { width: localNode.size?.width ?? 320, height: Number(e.target.value) })} />
          </div>
        </div>
      )}

      <div>
        <label className="text-xs font-semibold text-gray-600">Output Targets</label>
        <textarea
          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#17146E] focus:ring-2 focus:ring-[#17146E]/20"
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
      </div>

      <Button
        className="w-full"
        disabled={!isDirty}
        onClick={() => {
          onChange(localNode);
          setIsDirty(false);
        }}
      >
        Save Changes
      </Button>
    </div>
  );
}