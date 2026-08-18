import { useEffect, useRef, useState } from "react";
import { Handle, Position, type NodeProps } from "reactflow";
import { ChevronDown } from "lucide-react";
import { useClockStore } from "../../../store/clockStore";
import { NodeActionsMenu } from "./NodeActionsMenu";

type DividerNodeData = {
  label?: string | { text?: string };
  value?: number | string;
  default?: number | string;
  computedValue?: number | string;
  description?: string;
  isLocked?: boolean;
  raw?: { id?: string };
};

function getLabelText(label: DividerNodeData["label"], fallback: string): string {
  if (typeof label === "string") return label;
  return label?.text ?? fallback;
}

function hasValue(v: unknown): boolean {
  return v !== undefined && v !== null && v !== "";
}

export function DividerNode({ id, data }: NodeProps<DividerNodeData>) {
  const updateNode = useClockStore((state) => state.updateNode);
  const title = getLabelText(data?.label, "Divider");
  const nodeId = String(data?.raw?.id ?? id);

  const currentValue = Number(data?.value ?? data?.default ?? 1);
  const displayValue =
    hasValue(data?.computedValue) ? data?.computedValue : currentValue;

  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  const options = Array.from({ length: 15 }, (_, i) => i + 1);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };

    window.addEventListener("mousedown", onClickOutside);
    return () => window.removeEventListener("mousedown", onClickOutside);
  }, []);

  const selectValue = (val: number) => {
    updateNode(nodeId, {
      value: val,
      default: val
    });
    setOpen(false);
  };

  return (
    <div
      ref={ref}
      className="relative min-w-[138px] rounded-[2px] border border-[#4aa3ff] bg-white px-2 py-1 text-[9px] text-[#666666] shadow-none dark:border-[#3991e6] dark:bg-[#1e293b] dark:text-slate-300"
    >
      <div className="text-[10px] font-medium leading-none text-[#666666] dark:text-slate-300">
        {title}
      </div>

      <div className="mt-1 mr-5 relative">
        <button
          type="button"
          disabled={data?.isLocked}
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center justify-between rounded-[2px] border border-[#c9ced6] bg-white px-1 py-[2px] text-[9px] text-[#666666] outline-none disabled:cursor-not-allowed disabled:opacity-60 dark:border-[#2f3e52] dark:bg-[#243349] dark:text-slate-300"
        >
          <span className="text-[#666666] dark:text-slate-300">÷ {String(currentValue)}</span>
          <ChevronDown size={10} className="text-[#9aa3af]" />
        </button>

        {open ? (
          <div className="absolute left-0 top-full z-50 mt-1 w-full rounded-[2px] border border-[#c9ced6] bg-white shadow-lg dark:border-[#2f3e52] dark:bg-[#1e293b]">
            {options.map((opt) => {
              const active = Number(currentValue) === opt;

              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => selectValue(opt)}
                  className={`flex w-full items-center px-2 py-1 text-left text-[9px] ${
                    active
                      ? "bg-[#2a73ff] text-white"
                      : "text-[#666666] hover:bg-[#f3f6fb] dark:text-slate-300 dark:hover:bg-slate-700"
                  }`}
                >
                  ÷ {opt}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
      <NodeActionsMenu
        nodeId={nodeId}
        isLocked={data?.isLocked}
        style={{ right: 1, top: 16 }}
      />

      <div className="mt-1 text-[8px] leading-3 text-[#9aa3af]">
        Output:{" "}
        {displayValue !== undefined && displayValue !== null && displayValue !== ""
          ? String(displayValue)
          : "--"}
      </div>

      {data?.description ? (
        <div className="mt-1 text-[8px] leading-3 text-[#9aa3af]">
          {data.description}
        </div>
      ) : null}

      <Handle
        id="input"
        type="target"
        position={Position.Left}
        className="!h-[8px] !w-[8px] !border !border-[#c9ced6] !bg-white"
        style={{ left: "-4px", top: "50%", transform: "translateY(-50%)" }}
      />

      <Handle
        id="output"
        type="source"
        position={Position.Right}
        className="!h-[8px] !w-[8px] !border !border-[#4aa3ff] !bg-white"
        style={{ right: "-4px", top: "50%", transform: "translateY(-50%)" }}
      />
    </div>
  );
}