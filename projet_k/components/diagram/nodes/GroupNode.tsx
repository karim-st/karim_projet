import { NodeResizer, type NodeProps } from "reactflow";
import type { ClockLabel } from "../../../types/clock";
import { ChevronDown, ChevronRight, Diamond, Trash2 } from "lucide-react";

type Data = {
  label?: string | ClockLabel;
  isLocked?: boolean;
  raw?: { id?: string };
  groupId?: string;
  collapsed?: boolean;
  color?: string;
  readOnly?: boolean;
};

export function GroupNode({ id, data, selected }: NodeProps<Data>) {
  const label = typeof data?.label === "string" ? data.label : data?.label?.text;
  const groupId = String(data?.groupId ?? data?.raw?.id ?? id);
  const frameColor = "#ececf0";
  const emitAction = (action: "delete" | "toggle" | "rename" | "resize", detail = {}) =>
    window.dispatchEvent(new CustomEvent("clock-group-action", { detail: { action, groupId, ...detail } }));

  return (
    <div
          className="relative flex h-full w-full items-start justify-start rounded-[2px]"
        style={{
        backgroundColor: frameColor,
        boxShadow: "inset 0 0 0 1px #d4d4e2"
      }}
    >
      <NodeResizer
        isVisible={selected && !data?.readOnly}
        minWidth={180}
        minHeight={120}
        lineStyle={{ borderColor: "#bcbccc" }}
        handleStyle={{ width: 8, height: 8, borderColor: "#b9b9cc", backgroundColor: "#ffffff" }}
        onResizeEnd={(_, size) => emitAction("resize", { size: { width: size.width, height: size.height } })}
      />
      <div className="nodrag absolute -top-5 -right-6 flex items-center gap-1 rounded-sm px-1.5 py-0.5 shadow-sm" style={{ backgroundColor: frameColor }}>
        <Diamond size={10} fill="#64748b" strokeWidth={0} />
        <input
        className="w-40 border-b border-transparent bg-transparent px-0 py-0.5 text-right text-sm font-semibold text-[#374151] outline-none focus:border-[#64748b]"
        defaultValue={label ?? "Groupe"}
        readOnly={data?.readOnly}
        aria-label="Nom du groupe"
        onBlur={(event) => emitAction("rename", { label: event.target.value })}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
        }}
        />
      </div>
      <div className="nodrag absolute -top-1 left-2 flex items-center gap-1">
        <button type="button" disabled={data?.readOnly} title={data?.collapsed ? "Ouvrir le groupe" : "Réduire le groupe"} onClick={() => emitAction("toggle")} className="flex h-5 w-5 items-center justify-center text-[#64748b] hover:bg-[#e8edf4] disabled:cursor-not-allowed disabled:opacity-40">
          {data?.collapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
        </button>
        <button type="button" disabled={data?.readOnly} title="Supprimer le groupe" onClick={() => emitAction("delete")} className="flex h-5 w-5 items-center justify-center text-[#64748b] hover:bg-[#fee2e2] hover:text-[#dc2626] disabled:cursor-not-allowed disabled:opacity-40">
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
}