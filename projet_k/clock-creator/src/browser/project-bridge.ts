/**
 * Pont UI React ↔ contribution Theia (génération / FS projet).
 *
 * Flux applicatif :
 *   Toolbar / menus  →  requestXxx()  →  CustomEvent
 *   ClockCreatorContribution écoute  →  dialogs / FileService / WorkspaceService
 *   store.project mis à jour  →  JSON editor + diagramme (via useWorkspaceSync)
 */

export type ClockProjectBridgeAction = "new-project" | "open-project" | "save-project";

export const CLOCK_PROJECT_BRIDGE_EVENT = "clock-creator:project-bridge";

export type ClockProjectBridgeDetail = {
  action: ClockProjectBridgeAction;
};

export function requestNewProject(): void {
  dispatch("new-project");
}

export function requestOpenProject(): void {
  dispatch("open-project");
}

export function requestSaveProject(): void {
  dispatch("save-project");
}

function dispatch(action: ClockProjectBridgeAction): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<ClockProjectBridgeDetail>(CLOCK_PROJECT_BRIDGE_EVENT, {
      detail: { action }
    })
  );
}

export function subscribeProjectBridge(
  handler: (action: ClockProjectBridgeAction) => void
): () => void {
  if (typeof window === "undefined") {
    return () => undefined;
  }
  const listener = (event: Event) => {
    const detail = (event as CustomEvent<ClockProjectBridgeDetail>).detail;
    if (detail?.action) {
      handler(detail.action);
    }
  };
  window.addEventListener(CLOCK_PROJECT_BRIDGE_EVENT, listener);
  return () => window.removeEventListener(CLOCK_PROJECT_BRIDGE_EVENT, listener);
}
