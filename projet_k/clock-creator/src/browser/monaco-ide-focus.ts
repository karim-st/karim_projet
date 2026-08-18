/** Focus de l'éditeur Monaco intégré (Clock Creator) — partagé avec Theia keybindings */

let focused = false;

export function setClockMonacoFocused(next: boolean): void {
  focused = next;
}

export function isClockMonacoFocused(): boolean {
  if (focused) {
    return true;
  }
  const active = document.activeElement as HTMLElement | null;
  if (!active) {
    return false;
  }
  return Boolean(
    active.closest?.(".clock-monaco-host") ||
      active.closest?.('[data-monaco-ide="true"]') ||
      active.closest?.("#clock-creator-widget .monaco-editor")
  );
}
