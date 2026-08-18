import type { ClockBaseElement } from "../types/clock";
export type FlowZone = "sources" | "system" | "bus" | "peripherals" | "outputs" | "special";
export type Point = { x: number; y: number };

export const LAYOUT = {
  zoneX: {
    sources: 20,
    system: 220,
    bus: 420,
    peripherals: 650,
    outputs: 880,
    special: 1100
  } as Record<FlowZone, number>,
  topY: 20,
  groupYStep: 72,
  itemYStep: 42,
  collisionMarginX: 8,
  collisionMarginY: 6
};

function typeString(element: ClockBaseElement): string {
  return String(element.type ?? "").toLowerCase();
}

function roleString(element: ClockBaseElement): string {
  return String(element.role ?? "").toLowerCase();
}

function idString(element: ClockBaseElement): string {
  return String(element.id ?? "").toLowerCase();
}

export function getLabelText(label: ClockBaseElement["label"], fallback: string): string {
  if (typeof label === "string") return label;
  if (label && typeof label === "object" && typeof label.text === "string") return label.text;
  return fallback;
}

export function isMux(element: ClockBaseElement): boolean {
  const t = typeString(element);
  return t.includes("mux") || t.includes("multiplex");
}

export function isDivider(element: ClockBaseElement): boolean {
  const t = typeString(element);
  const r = roleString(element);
  return t.includes("divider") || t.includes("prescaler") || r.includes("divider") || r.includes("prescaler");
}

export function isSource(element: ClockBaseElement): boolean {
  const t = typeString(element);
  const r = roleString(element);
  const id = idString(element);

  return (
    t.includes("source") ||
    r.includes("oscillator") ||
    r.includes("source") ||
    id.includes("lsi") ||
    id.includes("lse") ||
    id.includes("hsi") ||
    id.includes("hse") ||
    id.includes("psi") ||
    id.includes("audio")
  );
}

export function isOutput(element: ClockBaseElement): boolean {
  const t = typeString(element);
  const r = roleString(element);
  return t.includes("output") || r.includes("output");
}

export function getZone(element: ClockBaseElement): FlowZone {
  const id = idString(element);
  const role = roleString(element);

  if (isSource(element)) return "sources";
  if (id.includes("system") || id.includes("sysclk") || id.includes("fclk") || id.includes("cortex")) return "system";

  if (
    isDivider(element) &&
    (
      id.includes("ahb") ||
      id.includes("apb") ||
      id.includes("cortex") ||
      id.includes("usb") ||
      id.includes("rng") ||
      id.includes("eth") ||
      id.includes("mco") ||
      id.includes("adc")
    )
  ) {
    return "bus";
  }

  if (
    isMux(element) &&
    (
      role.includes("mco") ||
      role.includes("pclk") ||
      id.includes("spi") ||
      id.includes("uart") ||
      id.includes("usart") ||
      id.includes("i2c") ||
      id.includes("i3c") ||
      id.includes("lptim") ||
      id.includes("lpuart") ||
      id.includes("adc") ||
      id.includes("dac") ||
      id.includes("eth") ||
      id.includes("fdcan") ||
      id.includes("usb") ||
      id.includes("rng")
    )
  ) {
    return "peripherals";
  }

  if (isOutput(element)) return "outputs";
  return "special";
}

export function getGroupKey(element: ClockBaseElement): string {
  const id = idString(element);
  const role = roleString(element);

  if (id.includes("rtc")) return "rtc";
  if (id.includes("cortex")) return "cortex";
  if (id.includes("usb")) return "usb";
  if (id.includes("rng")) return "rng";
  if (id.includes("mco")) return "mco";
  if (id.includes("spi")) return "spi";
  if (id.includes("uart") || id.includes("usart")) return "uart";
  if (id.includes("i2c") || id.includes("i3c")) return "i2c";
  if (id.includes("eth")) return "eth";
  if (id.includes("adc") || id.includes("dac")) return "adc_dac";
  if (id.includes("tim")) return "tim";
  if (id.includes("pwr")) return "pwr";
  if (role.includes("sysclk") || id.includes("system")) return "system";
  if (role.includes("pclk")) return role;
  return "default";
}

export function widthByKind(element: ClockBaseElement): number {
  if (isMux(element)) return 90;
  if (isDivider(element)) return 98;
  if (isSource(element)) return 118;
  if (isOutput(element)) return 116;
  return 118;
}

export function heightByKind(element: ClockBaseElement): number {
  if (isMux(element)) return 130;
  if (isDivider(element)) return 66;
  if (isSource(element)) return 66;
  if (isOutput(element)) return 66;
  return 66;
}

export function sortElements(elements: ClockBaseElement[]): ClockBaseElement[] {
  return [...elements].sort((a, b) => {
    const ga = getGroupKey(a);
    const gb = getGroupKey(b);
    if (ga !== gb) return ga.localeCompare(gb);

    const la = getLabelText(a.label, a.id);
    const lb = getLabelText(b.label, b.id);
    return la.localeCompare(lb);
  });
}

export function normalizePortId(value: string): string {
  return value.replace(/__.*$/, "").replace(/_output$/, "").replace(/_input$/, "");
}