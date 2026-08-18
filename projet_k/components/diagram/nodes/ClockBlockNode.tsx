import { Handle, Position, type NodeProps } from "reactflow";
import { useClockStore } from "../../../store/clockStore";
import { NodeActionsMenu } from "./NodeActionsMenu";

type UnitOption = {
  text: string;
  factor?: string;
};

export type ClockData = {
  mode?: "source" | "mux" | "divider" | "output";
  title?: string;
  label?: string | { text?: string };
  type?: string;
  unit?: { text?: string; factor?: string };
  unitOptions?: UnitOption[];
  value?: number | string;
  default?: number | string;
  computedValue?: number | string;
  description?: string;
  role?: string;
  isLocked?: boolean;
  raw?: { id?: string };
};

function getLabelText(label: ClockData["label"], fallback: string): string {
  if (typeof label === "string") return label;
  return label?.text ?? fallback;
}

function hasMeaningfulValue(v: unknown): boolean {
  return v !== undefined && v !== null && v !== "";
}

function toDisplayValue(v: unknown): string {
  if (!hasMeaningfulValue(v)) return "--";
  return String(v);
}

export function ClockBlockNode({ id, data }: NodeProps<ClockData>) {
  const updateNode = useClockStore((state) => state.updateNode);

  const title = getLabelText(data?.label, data?.title ?? "Clock");
  const unitText = data?.unit?.text ?? "MHz";
  const unitOptions = data?.unitOptions ?? [
    { text: "MHz", factor: "1000000" },
    { text: "KHz", factor: "1000" },
    { text: "Hz", factor: "1" }
  ];

  // IMPORTANT:
  // displayValue must never fallback to 0 silently
  const displayValue =
    hasMeaningfulValue(data?.computedValue)
      ? data?.computedValue
      : hasMeaningfulValue(data?.value)
        ? data?.value
        : hasMeaningfulValue(data?.default)
          ? data?.default
          : undefined;

  const nodeId = String(data?.raw?.id ?? id);

  const handleUnitChange = (nextUnitText: string) => {
    const selectedUnit = unitOptions.find((u) => u.text === nextUnitText);

    updateNode(nodeId, {
      unit: {
        text: selectedUnit?.text ?? nextUnitText,
        factor: selectedUnit?.factor
      }
    });
  };

  return (
    <div className="relative min-w-[150px] rounded-[2px] border border-[#c9ced6] bg-white px-2 py-1 text-[9px] text-[#666666] shadow-none">
      <div className="text-[10px] font-medium leading-none text-[#666666]">
        {title}
      </div>

      <div className="mt-1 mr-5 flex items-center gap-1 rounded-[2px] border border-[#c9ced6] bg-white px-1 py-[2px]">
        <select
          value={unitText}
          disabled={data?.isLocked}
          onChange={(e) => handleUnitChange(e.target.value)}
          className="min-w-[52px] bg-transparent text-[9px] text-[#9aa3af] outline-none disabled:cursor-not-allowed"
        >
          {unitOptions.map((unit) => (
            <option key={unit.text} value={unit.text}>
              {unit.text}
            </option>
          ))}
        </select>
        <span className="ml-auto text-right font-medium">
          {displayValue !== undefined ? toDisplayValue(displayValue) : "--"}
        </span>
      </div>
      <NodeActionsMenu
        nodeId={nodeId}
        isLocked={data?.isLocked}
        style={{ right: 1, top: 16 }}
      />

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
        className="!h-[8px] !w-[8px] !border !border-[#c9ced6] !bg-white"
        style={{ right: "-4px", top: "50%", transform: "translateY(-50%)" }}
      />
    </div>
  );
}