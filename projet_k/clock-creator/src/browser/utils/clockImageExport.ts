import { toCanvas, toSvg } from "html-to-image";
import { useClockStore } from "../store/clockStore";

export type DiagramExportFormat = "png" | "jpg" | "svg";

const EXPORT_PIXEL_RATIO = 2;

function findDiagramNode(): HTMLElement | null {
  const widget = document.getElementById("clock-creator-widget");
  if (!widget) {
    return null;
  }
  return widget.querySelector<HTMLElement>(".react-flow");
}

function captureBackgroundColor(): string {
  const widget = document.getElementById("clock-creator-widget");
  const root = widget?.querySelector<HTMLElement>('[aria-label^="Clock diagram"]');
  const color = root ? getComputedStyle(root).backgroundColor : "";
  return color && color !== "rgba(0, 0, 0, 0)" ? color : "#f5f6f8";
}

function exportFileName(extension: string): string {
  const id = useClockStore.getState().project.tree.id || "clock-tree";
  return `${id}-diagram.${extension}`;
}

function downloadUrl(dataUrl: string, fileName: string): void {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  try {
    downloadUrl(url, fileName);
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  }
}

function isChromeUi(element: HTMLElement): boolean {
  return (
    element.classList.contains("react-flow__minimap") ||
    element.classList.contains("react-flow__controls") ||
    element.classList.contains("react-flow__attribution")
  );
}

/**
 * html-to-image applique `filter` à CHAQUE nœud cloné, y compris les nœuds
 * texte/commentaire (childNodes) qui n'ont pas de `classList` — il faut les
 * garder sans les inspecter, sinon « Cannot read properties of undefined ».
 */
function shouldKeepNode(node: Node): boolean {
  if (!(node instanceof HTMLElement)) {
    return true;
  }
  return !isChromeUi(node);
}

/**
 * Options html-to-image.
 * - `skipFonts`: ne PAS aller chercher les polices web par fetch — l'embedding
 *   échoue dans l'environnement Theia (ressources du bundle) et fait planter
 *   l'export. Les polices système sont utilisées à la place.
 * - `filter`: exclut minimap / contrôles / attribution de la capture.
 */
function buildOptions() {
  return {
    filter: shouldKeepNode,
    pixelRatio: EXPORT_PIXEL_RATIO,
    cacheBust: false,
    skipFonts: true,
    backgroundColor: captureBackgroundColor()
  };
}

export async function exportDiagramImage(format: DiagramExportFormat): Promise<string> {
  const node = findDiagramNode();
  if (!node) {
    throw new Error("Diagramme introuvable : ouvrez l'éditeur Clock Creator.");
  }

  const fileName = exportFileName(format);
  const options = buildOptions();

  if (format === "svg") {
    const dataUrl = await toSvg(node, options);
    downloadUrl(dataUrl, fileName);
    return fileName;
  }

  const canvas = await toCanvas(node, options);
  const mime = format === "jpg" ? "image/jpeg" : "image/png";
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, mime, format === "jpg" ? 0.92 : undefined);
  });
  if (!blob) {
    throw new Error(`Génération de l'image ${format.toUpperCase()} impossible.`);
  }
  downloadBlob(blob, fileName);
  return fileName;
}