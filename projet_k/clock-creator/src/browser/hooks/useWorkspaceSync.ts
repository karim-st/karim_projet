import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { parseJsonSafe } from "../utils/jsonParser";
import { clockTreeToFlow } from "../utils/clockTreeMapper";
import { findNodeJsonRange } from "../utils/jsonSearch";
import type { ClockTreeFile } from "../types/clock";
import { useClockStore } from "../store/clockStore";
import { isClockMonacoFocused } from "../monaco-ide-focus";

const DRAFT_KEY = "clock_creator_draft";

/**
 * Relie les 3 couches de l'application :
 * 1. Projet (store) — source de vérité métier
 * 2. JSON (éditeur) — sérialisation éditable
 * 3. Workflow (React Flow) — vue diagramme dérivée du projet
 */
export function useWorkspaceSync() {
  const project = useClockStore((s) => s.project);
  const setProject = useClockStore((s) => s.setProject);
  const updateProjectFromJson = useClockStore((s) => s.updateProjectFromJson);
  const selectedNodeId = useClockStore((s) => s.selectedNodeId);
  const activeProjectFile = useClockStore((s) => s.activeProjectFile);
  const activeProjectFolder = useClockStore((s) => s.activeProjectFolder);

  const [jsonText, setJsonText] = useState(() => JSON.stringify(project, null, 2));
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [, setHistoryVersion] = useState(0);

  const historyRef = useRef({
    past: [] as string[],
    current: JSON.stringify(project),
    future: [] as string[]
  });
  const storePushTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Projet → JSON (diagramme / store externe). Ne pas écraser pendant la frappe Monaco.
  useEffect(() => {
    const snapshot = JSON.stringify(project);
    const history = historyRef.current;
    if (snapshot === history.current) {
      return;
    }
    history.past.push(history.current);
    history.current = snapshot;
    history.future = [];
    setHistoryVersion((v) => v + 1);
    if (isClockMonacoFocused()) {
      return;
    }
    setJsonText(JSON.stringify(project, null, 2));
    setJsonError(null);
  }, [project]);

  // JSON → Projet : debounce pour ne pas normaliser/réécrire à chaque touche
  const applyJsonToProject = useCallback((value: string) => {
    setJsonText(value);
    try {
      localStorage.setItem(DRAFT_KEY, value);
    } catch {
      /* ignore */
    }
    if (storePushTimer.current) {
      clearTimeout(storePushTimer.current);
      storePushTimer.current = undefined;
    }
    const parsed = parseJsonSafe<ClockTreeFile>(value);
    if (parsed.error) {
      setJsonError(parsed.error);
      return;
    }
    setJsonError(null);
    const current = JSON.stringify(useClockStore.getState().project);
    const next = JSON.stringify(parsed.data);
    if (current === next) {
      return;
    }
    storePushTimer.current = setTimeout(() => {
      historyRef.current.current = JSON.stringify(parsed.data);
      updateProjectFromJson(value);
    }, 450);
  }, [updateProjectFromJson]);

  useEffect(() => {
    return () => {
      if (storePushTimer.current) {
        clearTimeout(storePushTimer.current);
      }
    };
  }, []);

  // Projet → Workflow
  const flow = useMemo(() => clockTreeToFlow(project), [project]);

  const focusRange = useMemo(() => {
    if (!selectedNodeId) return null;
    return findNodeJsonRange(jsonText, selectedNodeId);
  }, [selectedNodeId, jsonText]);

  const canUndo = historyRef.current.past.length > 0;
  const canRedo = historyRef.current.future.length > 0;

  const restoreSnapshot = useCallback(
    (snapshot: string) => {
      const restored = JSON.parse(snapshot) as ClockTreeFile;
      setProject(restored);
      setJsonText(JSON.stringify(restored, null, 2));
      localStorage.setItem(DRAFT_KEY, JSON.stringify(restored, null, 2));
    },
    [setProject]
  );

  const undo = useCallback(() => {
    const history = historyRef.current;
    const previous = history.past.pop();
    if (!previous) return;
    history.future.push(history.current);
    history.current = previous;
    restoreSnapshot(previous);
    setHistoryVersion((v) => v + 1);
  }, [restoreSnapshot]);

  const redo = useCallback(() => {
    const history = historyRef.current;
    const next = history.future.pop();
    if (!next) return;
    history.past.push(history.current);
    history.current = next;
    restoreSnapshot(next);
    setHistoryVersion((v) => v + 1);
  }, [restoreSnapshot]);

  const importJsonText = useCallback(
    (text: string, fileName?: string) => {
      const parsed = parseJsonSafe<ClockTreeFile>(text);
      if (!parsed.data) {
        setJsonError(parsed.error ?? "JSON invalide");
        return false;
      }
      setProject(parsed.data);
      if (fileName) {
        useClockStore.getState().importProject(fileName, parsed.data);
      }
      setJsonError(null);
      return true;
    },
    [setProject]
  );

  const exportJsonBlob = useCallback(() => {
    const name = activeProjectFile || "clock.json";
    const data = JSON.stringify(project, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    link.click();
    URL.revokeObjectURL(url);
  }, [project, activeProjectFile]);

  return {
    project,
    jsonText,
    jsonError,
    flow,
    focusRange,
    activeProjectFile,
    activeProjectFolder,
    canUndo,
    canRedo,
    applyJsonToProject,
    undo,
    redo,
    importJsonText,
    exportJsonBlob,
    setProject
  };
}
