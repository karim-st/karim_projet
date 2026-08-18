export interface ClockLabel {
  align: "top" | "right" | "left" | "bottom";
  text: string;
}

export interface ClockDiagnostic {
  id: string;
  nodeId?: string;
  field?: string;
  message: string;
  level: "info" | "warn" | "error" | "debug";
}

export interface ClockInputOption {
  label: string;
  description?: string;
  available: boolean;
  input_Id: string;
  from: string;
  sourceType?: string;
  isLocked: boolean;
  sourceDisabled: boolean;
}

export interface ClockMuxState {
  selectedInputId?: string;
  activeInputId?: string;
  availableInputs?: string[];
  lockedInputs?: string[];
  disabledInputs?: string[];
}

export interface ClockBaseElement {
  id: string;
  type: string;
  kind: string;
  label?: string | ClockLabel;
  description?: string;
  position: { x: number; y: number };
  size?: { width: number; height: number };
  outputTargets?: string[];
  role?: string;
  block?: string;
  unit?: { text?: string; factor?: string };
  unitOptions?: { text: string; factor?: string }[];
  actions?: any;
  min?: number;
  max?: number;
  default?: number | string;
  value?: number | string;
  computedValue?: number | string;
  outputClockId?: string;
  details?: any;
  oneOf?: { const: number | string }[];
  possible_Input?: ClockInputOption[];
  clocked_instance?: any;
  orientation?: "horizontal" | "vertical";
  orphanLink?: { label: string; isOrphan: boolean };
  isTrustZone?: boolean;
  isLocked?: boolean;
  isEnabled?: boolean;
  sourceDisabled?: boolean;
  editableFields?: string[];
  readonlyFields?: string[];
  constraints?: any;
  ui?: {
    fillColor?: string;
    outlineColor?: string;
    color?: string;
    fontFamily?: string;
    fontSize?: number;
    variant?: string;
  };
  logicalId?: string;
  collapsed?: boolean;
  muxState?: ClockMuxState;
  base?: number;
  power?: number;
  factor?: number;
}

export interface ClockTransition {
  id: string;
  sourceTaskId: string;
  targetTaskId: string;
  startLabel?: string;
  endLabel?: string;
  sourcePortId?: string;
  targetPortId?: string;
  labelPosition?: { x: number; y: number };
  transitionRoutingPoint?: { kind: "linear"; x: number; y: number; pointIndex: number }[];
  isVirtual: boolean;
  lineStyle?: "normal" | "dashed" | "bold";
  hasError?: boolean;
}

export interface ClockNodeGroup {
  id: string;
  label: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  nodeIds: string[];
  collapsed?: boolean;
  color?: string;
}

export interface ClockTreeFile {
  master_clock_version: string;
  copyright: string;
  version: string;
  tree: {
    id: string;
    schema_version: string;
    elements: ClockBaseElement[];
    transitions: ClockTransition[];
    groups?: ClockNodeGroup[];
  };
}

export type ClockTransitionLineStyle = "normal" | "dashed" | "bold";
