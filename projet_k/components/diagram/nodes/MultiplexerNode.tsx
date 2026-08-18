import { Handle, Position, type NodeProps } from "reactflow";
import { useClockStore } from "../../../store/clockStore";
import type { ClockMuxState } from "../../../types/clock";
import { NodeActionsMenu } from "./NodeActionsMenu";

type MuxInput = {
  label: string;
  input_Id: string;
  from: string;
  available?: boolean;
  description?: string;
  isLocked?: boolean;
  sourceDisabled?: boolean;
};

type Data = {
  label?: string | { text?: string };
  possible_Input?: MuxInput[];
  value?: string | number;
  default?: string | number;
  computedValue?: string | number;
  description?: string;
  isLocked?: boolean;
  isEnabled?: boolean;
  size?: { width: number; height: number };
  raw?: { id?: string };
  muxState?: ClockMuxState;
};

function getLabel(label: Data["label"]): string {
  if (typeof label === "string") return label;
  return label?.text ?? "Mux";
}

function resolveSelectedInputId(data: Data): { inputId: string; from: string } {
  const inputs = data?.possible_Input ?? [];
  if (inputs.length === 0) return { inputId: "", from: "" };
  const muxId = data?.muxState?.selectedInputId;
  if (muxId) {
    const match = inputs.find((i) => i.input_Id === muxId || i.from === muxId);
    if (match) return { inputId: match.input_Id, from: match.from };
  }
  const val = String(data?.value ?? "");
  if (val && val !== "undefined" && val !== "null") {
    const match = inputs.find((i) => i.input_Id === val || i.from === val);
    if (match) return { inputId: match.input_Id, from: match.from };
  }
  const def = String(data?.default ?? "");
  if (def && def !== "undefined" && def !== "null") {
    const match = inputs.find((i) => i.input_Id === def || i.from === def);
    if (match) return { inputId: match.input_Id, from: match.from };
  }
  const firstAvail = inputs.find((i) => i.available !== false && !i.isLocked && !i.sourceDisabled);
  if (firstAvail) return { inputId: firstAvail.input_Id, from: firstAvail.from };
  return { inputId: inputs[0].input_Id, from: inputs[0].from };
}

export function MultiplexerNode({ id, data }: NodeProps<Data>) {
  const setMuxSelection = useClockStore((state) => state.setMuxSelection);
  const selectNode = useClockStore((state) => state.selectNode);
  const darkMode = useClockStore((state) => state.darkMode);
  const nodeId = String(data?.raw?.id ?? id);
  const possibleInputs = data?.possible_Input ?? [];
  const muxDisabled = data?.isLocked === true || data?.isEnabled === false;
  const resolved = resolveSelectedInputId(data ?? {});

  const handleSelection = (inputId: string, fromValue: string) => {
    if (muxDisabled) return;
    setMuxSelection(nodeId, inputId, fromValue);
  };

  const inputCount = Math.max(possibleInputs.length, 1);
  const title = getLabel(data?.label);
  const titleWidth = Math.max(20, title.length * 6);
  const titleCenter = 140;
  const titleLeft = titleCenter - titleWidth / 2;
  const actionsLeft = titleLeft + titleWidth + 2;
  const colors = darkMode
    ? {
        title: "#e5edf6",
        label: "#c3d0df",
        line: "#9aabba",
        disabledLine: "#526274",
        body: "#334154",
        output: "#56a9ff"
      }
    : {
        title: "#334a63",
        label: "#40536a",
        line: "#8795a5",
        disabledLine: "#cbd2da",
        body: "#dfe7f0",
        output: "#4a89ff"
      };

  const S = {
    labelW: 92,
    trapW: 28,
    trapL: 132,
    totalW: 160,
    rowH: 28,
    titleH: 26,
    bodyH: Math.max(96, inputCount * 28 + 10)
  };

  const inputRows = possibleInputs.map((input, index) => {
    const top = 8 + index * S.rowH;
    const isChecked = resolved.inputId === input.input_Id;
    const isDisabled = muxDisabled || input.available === false || input.isLocked === true || input.sourceDisabled === true;
    const lineColor = isDisabled ? colors.disabledLine : colors.line;
    return (
      <div
        key={input.input_Id}
        style={{
          position: "absolute",
          left: 0,
          top,
          width: S.totalW,
          height: S.rowH,
          cursor: isDisabled ? "not-allowed" : "pointer",
          opacity: isDisabled ? 0.5 : 1,
          zIndex: 2
        }}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          selectNode(nodeId);
          if (!isDisabled) handleSelection(input.input_Id, input.from);
        }}
      >
        <Handle
          id={`${nodeId}__${input.input_Id}`}
          type="target"
          position={Position.Left}
          isConnectable={!isDisabled}
          style={{ left: S.trapL - 2, top: "50%", opacity: 0 }}
        />
        <div style={{
          position: "absolute",
          left: 36,
          top: 1,
          width: S.labelW - 4,
          height: 11,
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "flex-end",
          color: colors.label,
          fontSize: 9,
          fontWeight: 400,
          lineHeight: "10px",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis"
        }} title={input.description ?? input.label}>
          {input.label}
        </div>
        <div style={{
          position: "absolute",
          left: S.labelW,
          top: "50%",
          width: S.trapL - S.labelW - 7,
          height: 1,
          background: lineColor
        }} />
        <div style={{
          position: "absolute",
          left: S.trapL - 5,
          top: "50%",
          width: 0,
          height: 0,
          borderTop: "4px solid transparent",
          borderBottom: "4px solid transparent",
          borderLeft: `6px solid ${lineColor}`,
          transform: "translateY(-50%)"
        }} />
        <input
          type="radio"
          name={`${nodeId}_mux_inputs`}
          value={input.input_Id}
          checked={isChecked}
          disabled={isDisabled}
          aria-label={input.label}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            selectNode(nodeId);
          }}
          onChange={() => handleSelection(input.input_Id, input.from)}
          style={{
            position: "absolute",
            left: S.trapL + 3,
            top: "50%",
            width: 14,
            height: 14,
            margin: 0,
            accentColor: "#087fdb",
            cursor: isDisabled ? "not-allowed" : "pointer",
            transform: "translateY(-50%)",
            zIndex: 3
          }}
        />
      </div>
    );
  });

  return (
    <div style={{
      position: "relative",
      width: S.totalW,
      background: "transparent",
      color: colors.label,
      fontFamily: "'Segoe UI', Arial, sans-serif",
      userSelect: "none",
      fontSize: 10,
      overflow: "visible"
    }}>
      <div style={{
        position: "relative",
        height: S.titleH,
        overflow: "visible"
      }}>
        <span style={{
          position: "absolute",
          left: titleCenter,
          top: "50%",
          color: colors.title,
          fontSize: 11,
          fontWeight: 400,
          lineHeight: "14px",
          whiteSpace: "nowrap",
          transform: "translate(-50%, -50%)"
        }}>
          {title}
        </span>
        <NodeActionsMenu
          nodeId={nodeId}
          isLocked={data?.isLocked}
          className="right-auto top-0"
          style={{ left: actionsLeft }}
        />
      </div>
      <div style={{ position: "relative", width: S.totalW, height: S.bodyH }}>
        <svg
          aria-hidden="true"
          width={S.trapW}
          height={S.bodyH}
          viewBox={`0 0 ${S.trapW} ${S.bodyH}`}
          style={{
            position: "absolute",
            left: S.trapL,
            top: 0,
            zIndex: 1,
            overflow: "visible",
            pointerEvents: "none"
          }}
        >
          <polygon
            points={`0,0 ${S.trapW},10 ${S.trapW},${S.bodyH - 10} 0,${S.bodyH}`}
            fill={colors.body}
          />
        </svg>
        {inputRows}
      </div>
      <Handle
        id="output"
        type="source"
        position={Position.Right}
        style={{
          right: -4,
          top: S.titleH + S.bodyH / 2,
          width: 7,
          height: 7,
          border: "1px solid #ffffff",
          background: "#ffffff",
          borderRadius: "50%",
          opacity: 1,
          zIndex: 4,
          transform: "translateY(-50%)"
        }}
      />
    </div>
  );
}