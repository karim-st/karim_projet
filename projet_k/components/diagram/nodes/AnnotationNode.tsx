import { NodeResizer, type NodeProps } from "reactflow";
import { GripVertical } from "lucide-react";
import { useClockStore } from "../../../store/clockStore";
import type { ClockLabel } from "../../../types/clock";

type AnnotationData = {
  type?: string;
  label?: string | ClockLabel;
  ui?: {
    fontFamily?: string;
    fontSize?: number;
    color?: string;
    fillColor?: string;
    outlineColor?: string;
  };
  raw?: { id?: string };
};

function labelText(label: AnnotationData["label"]): string {
  return typeof label === "string" ? label : label?.text ?? "";
}

export function AnnotationNode({ id, data, selected }: NodeProps<AnnotationData>) {
  const updateNode = useClockStore((state) => state.updateNode);
  const selectedNodeId = useClockStore((state) => state.selectedNodeId);
  const nodeId = String(data?.raw?.id ?? id);
  const type = data?.type ?? "annotationText";
  const isText = type === "annotationText";
  const isCircle = type === "annotationCircle";
  const isSquare = type === "annotationSquare";

  if (isText) {
    return (
      <div className="flex h-full w-full items-center gap-1 rounded border border-transparent px-1 hover:border-[#9eb1c8]">
        <div className="annotation-drag-handle flex cursor-move items-center text-[#718197]" title="Déplacer le texte" aria-label="Déplacer le texte">
          <GripVertical size={14} aria-hidden="true" />
        </div>
        <input
          className="nodrag min-w-0 flex-1 border-0 bg-transparent py-0.5 text-center outline-none"
          value={labelText(data?.label)}
          onChange={(event) => updateNode(nodeId, { label: { text: event.target.value, align: "top" } })}
          style={{
            color: data?.ui?.color ?? "#263548",
            fontFamily: data?.ui?.fontFamily ?? "Georgia, serif",
            fontSize: data?.ui?.fontSize ?? 16
          }}
          aria-label="Texte d'annotation"
        />
      </div>
    );
  }

  return (
    <>
      <NodeResizer
        isVisible={selected || selectedNodeId === nodeId}
        minWidth={40}
        minHeight={40}
        keepAspectRatio={isCircle || isSquare}
        lineClassName="!border-[#2563eb]"
        handleClassName="!h-2.5 !w-2.5 !border-[#2563eb] !bg-white"
        onResizeEnd={(_, size) => updateNode(nodeId, { size: { width: size.width, height: size.height } })}
      />
      <div
        className={`h-full w-full border-2 border-dashed shadow-sm ${
          isCircle ? "rounded-full" : isSquare ? "rounded-[2px]" : "rounded-md"
        }`}
        style={{
          backgroundColor: data?.ui?.fillColor ?? "#dbeafe",
          borderColor: data?.ui?.outlineColor ?? "#2563eb"
        }}
        aria-label={isCircle ? "Cercle" : isSquare ? "Carré" : "Rectangle"}
      />
    </>
  );
}