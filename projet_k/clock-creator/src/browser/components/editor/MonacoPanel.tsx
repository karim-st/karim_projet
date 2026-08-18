import Editor, { type OnMount } from "@monaco-editor/react";
import type * as monaco from "monaco-editor";
import { useEffect, useRef } from "react";
import { useClockStore } from "../../store/clockStore";
import { requestSaveProject } from "../../project-bridge";
import { setClockMonacoFocused } from "../../monaco-ide-focus";

type MonacoPanelProps = {
  value: string;
  onChange: (value: string) => void;
  focusRange?: { startLine: number; endLine: number } | null;
  /** Change uniquement quand on clique un nœud — ne pas recaler le curseur à chaque frappe */
  selectedNodeId?: string | null;
};

async function pasteIntoEditor(editor: monaco.editor.IStandaloneCodeEditor): Promise<void> {
  let text = "";
  try {
    text = await navigator.clipboard.readText();
  } catch {
    editor.trigger("keyboard", "editor.action.clipboardPasteAction", null);
    return;
  }
  const selection = editor.getSelection() ?? editor.getModel()?.getFullModelRange();
  if (!selection) return;
  editor.focus();
  editor.pushUndoStop();
  editor.executeEdits("ide-paste", [{ range: selection, text, forceMoveMarkers: true }]);
  editor.pushUndoStop();
  editor.revealPositionInCenterIfOutsideViewport(editor.getPosition()!);
}

function run(editor: monaco.editor.IStandaloneCodeEditor, actionId: string): void {
  const action = editor.getAction(actionId);
  if (action?.isSupported()) {
    void action.run();
    return;
  }
  editor.trigger("keyboard", actionId, null);
}

function registerIdeActions(
  editor: monaco.editor.IStandaloneCodeEditor,
  monacoInstance: typeof monaco
): void {
  const kb = monacoInstance.KeyMod;
  const Key = monacoInstance.KeyCode;

  const bind = (keybinding: number, handler: () => void) => {
    editor.addCommand(keybinding, handler);
  };

  // Menu contextuel (clic droit) — mêmes entrées qu'un IDE classique
  const menuItems: Array<{
    id: string;
    label: string;
    keybinding?: number;
    order: number;
    group: string;
    run: () => void | Promise<void>;
  }> = [
    {
      id: "clock.monaco.goToSymbol",
      label: "Go to Symbol...",
      keybinding: kb.CtrlCmd | kb.Shift | Key.KeyO,
      group: "1_clock_nav",
      order: 1,
      run: () => run(editor, "editor.action.quickOutline")
    },
    {
      id: "clock.monaco.changeAllOccurrences",
      label: "Change All Occurrences",
      keybinding: kb.CtrlCmd | Key.F2,
      group: "1_clock_nav",
      order: 2,
      run: () => run(editor, "editor.action.changeAll")
    },
    {
      id: "clock.monaco.formatDocument",
      label: "Format Document",
      keybinding: kb.Alt | kb.Shift | Key.KeyF,
      group: "2_clock_edit",
      order: 1,
      run: () => run(editor, "editor.action.formatDocument")
    },
    {
      id: "clock.monaco.cut",
      label: "Cut",
      keybinding: kb.CtrlCmd | Key.KeyX,
      group: "3_clock_clip",
      order: 1,
      run: () => run(editor, "editor.action.clipboardCutAction")
    },
    {
      id: "clock.monaco.copy",
      label: "Copy",
      keybinding: kb.CtrlCmd | Key.KeyC,
      group: "3_clock_clip",
      order: 2,
      run: () => run(editor, "editor.action.clipboardCopyAction")
    },
    {
      id: "clock.monaco.paste",
      label: "Paste",
      keybinding: kb.CtrlCmd | Key.KeyV,
      group: "3_clock_clip",
      order: 3,
      run: () => void pasteIntoEditor(editor)
    },
    {
      id: "clock.monaco.commandPalette",
      label: "Command Palette",
      keybinding: Key.F1,
      group: "9_clock_cmd",
      order: 1,
      run: () => run(editor, "editor.action.quickCommand")
    }
  ];

  for (const item of menuItems) {
    editor.addAction({
      id: item.id,
      label: item.label,
      keybindings: item.keybinding !== undefined ? [item.keybinding] : undefined,
      contextMenuGroupId: item.group,
      contextMenuOrder: item.order,
      run: () => {
        void item.run();
      }
    });
    if (item.keybinding !== undefined) {
      bind(item.keybinding, () => {
        void item.run();
      });
    }
  }

  // Raccourcis édition complémentaires
  bind(kb.CtrlCmd | Key.KeyA, () => run(editor, "editor.action.selectAll"));
  bind(kb.CtrlCmd | Key.KeyZ, () => run(editor, "undo"));
  bind(kb.CtrlCmd | Key.KeyY, () => run(editor, "redo"));
  bind(kb.CtrlCmd | kb.Shift | Key.KeyZ, () => run(editor, "redo"));
  bind(kb.CtrlCmd | Key.KeyF, () => run(editor, "actions.find"));
  bind(kb.CtrlCmd | Key.KeyH, () => run(editor, "editor.action.startFindReplaceAction"));
  bind(kb.CtrlCmd | Key.KeyG, () => run(editor, "editor.action.gotoLine"));
  bind(kb.CtrlCmd | Key.KeyD, () => run(editor, "editor.action.copyLinesDownAction"));
  bind(kb.CtrlCmd | kb.Shift | Key.KeyK, () => run(editor, "editor.action.deleteLines"));
  bind(kb.Alt | Key.UpArrow, () => run(editor, "editor.action.moveLinesUpAction"));
  bind(kb.Alt | Key.DownArrow, () => run(editor, "editor.action.moveLinesDownAction"));
  bind(kb.Alt | kb.Shift | Key.UpArrow, () => run(editor, "editor.action.insertCursorAbove"));
  bind(kb.Alt | kb.Shift | Key.DownArrow, () => run(editor, "editor.action.insertCursorBelow"));
  bind(kb.CtrlCmd | kb.Alt | Key.UpArrow, () => run(editor, "editor.action.insertCursorAbove"));
  bind(kb.CtrlCmd | kb.Alt | Key.DownArrow, () => run(editor, "editor.action.insertCursorBelow"));
  bind(kb.CtrlCmd | Key.Slash, () => run(editor, "editor.action.commentLine"));
  bind(kb.CtrlCmd | kb.Shift | Key.KeyI, () => run(editor, "editor.action.formatDocument"));
  bind(kb.CtrlCmd | Key.BracketLeft, () => run(editor, "editor.action.outdentLines"));
  bind(kb.CtrlCmd | Key.BracketRight, () => run(editor, "editor.action.indentLines"));
  bind(kb.CtrlCmd | Key.KeyS, () => requestSaveProject());
}

/**
 * Intercepte les raccourcis AU NIVEAU WINDOW (avant Theia sur document)
 * et les exécute dans Monaco — Theia ignore ensuite car defaultPrevented.
 */
function attachWindowShortcutBridge(
  host: HTMLElement,
  getEditor: () => monaco.editor.IStandaloneCodeEditor | null
): () => void {
  const isFocusInside = () => {
    const active = document.activeElement as HTMLElement | null;
    return Boolean(active && host.contains(active));
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (!isFocusInside()) return;

    const editor = getEditor();
    if (!editor) return;

    const mod = event.ctrlKey || event.metaKey;
    const alt = event.altKey;
    const key = event.key.toLowerCase();
    const code = event.code;

    // Espace : React Flow (panoramique) et Theia avalent la touche en capture
    // avant Monaco — on l'insère explicitement.
    if (!mod && !alt && (code === "Space" || event.key === " ")) {
      event.preventDefault();
      event.stopPropagation();
      editor.trigger("keyboard", "type", { text: " " });
      return;
    }

    // Laisser la frappe normale (lettres, chiffres) à Monaco / navigateur
    if (!mod && !alt && code !== "Delete" && code !== "F1" && code !== "F2") {
      return;
    }

    type Handler = () => void;
    let handler: Handler | undefined;

    if (code === "F1") handler = () => run(editor, "editor.action.quickCommand");
    else if (mod && event.shiftKey && key === "o") handler = () => run(editor, "editor.action.quickOutline");
    else if (mod && code === "F2") handler = () => run(editor, "editor.action.changeAll");
    else if (mod && !alt && key === "v") handler = () => void pasteIntoEditor(editor);
    else if (mod && !alt && key === "c") handler = () => run(editor, "editor.action.clipboardCopyAction");
    else if (mod && !alt && key === "x") handler = () => run(editor, "editor.action.clipboardCutAction");
    else if (mod && !alt && key === "a") handler = () => run(editor, "editor.action.selectAll");
    else if (mod && !alt && key === "z" && event.shiftKey) handler = () => run(editor, "redo");
    else if (mod && !alt && key === "z") handler = () => run(editor, "undo");
    else if (mod && !alt && key === "y") handler = () => run(editor, "redo");
    else if (mod && !alt && key === "f") handler = () => run(editor, "actions.find");
    else if (mod && !alt && key === "h") handler = () => run(editor, "editor.action.startFindReplaceAction");
    else if (mod && !alt && key === "g") handler = () => run(editor, "editor.action.gotoLine");
    else if (mod && !alt && key === "d") handler = () => run(editor, "editor.action.copyLinesDownAction");
    else if (mod && event.shiftKey && key === "k") handler = () => run(editor, "editor.action.deleteLines");
    else if (mod && !alt && key === "s") handler = () => requestSaveProject();
    else if (mod && event.shiftKey && key === "i") handler = () => run(editor, "editor.action.formatDocument");
    else if (mod && key === "/") handler = () => run(editor, "editor.action.commentLine");
    else if (mod && key === "[") handler = () => run(editor, "editor.action.outdentLines");
    else if (mod && key === "]") handler = () => run(editor, "editor.action.indentLines");
    else if (alt && event.shiftKey && key === "f") handler = () => run(editor, "editor.action.formatDocument");
    else if (alt && !event.shiftKey && code === "ArrowUp") handler = () => run(editor, "editor.action.moveLinesUpAction");
    else if (alt && !event.shiftKey && code === "ArrowDown") handler = () => run(editor, "editor.action.moveLinesDownAction");
    else if (alt && event.shiftKey && code === "ArrowUp") handler = () => run(editor, "editor.action.insertCursorAbove");
    else if (alt && event.shiftKey && code === "ArrowDown") handler = () => run(editor, "editor.action.insertCursorBelow");

    if (!handler) {
      // Bloque seulement Theia pour les raccourcis connus ; sinon laisse passer
      if (mod || alt) {
        // Empêche Theia d'exécuter une commande globale, laisse Monaco gérer
        event.preventDefault();
      }
      return;
    }

    // Empêche Theia (document capture) : run() ignore si defaultPrevented
    event.preventDefault();
    event.stopPropagation();
    handler();
  };

  // window + capture = AVANT Theia (document + capture)
  window.addEventListener("keydown", onKeyDown, true);
  return () => window.removeEventListener("keydown", onKeyDown, true);
}

export function MonacoPanel({ value, onChange, focusRange, selectedNodeId }: MonacoPanelProps) {
  const darkMode = useClockStore((state) => state.darkMode);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof monaco | null>(null);
  const decorationRef = useRef<string[]>([]);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const lastLocalValueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const lastJumpedNodeRef = useRef<string | null>(null);
  const hasTextFocusRef = useRef(false);

  const handleMount: OnMount = (editor, monacoInstance) => {
    editorRef.current = editor;
    monacoRef.current = monacoInstance;

    const model = editor.getModel();
    if (model) {
      monacoInstance.editor.setModelLanguage(model, "json");
      model.updateOptions({ tabSize: 2, insertSpaces: true, trimAutoWhitespace: false });
      if (model.getValue() !== value) {
        model.setValue(value);
      }
      lastLocalValueRef.current = model.getValue();
    }

    monacoInstance.languages.json.jsonDefaults.setDiagnosticsOptions({
      validate: true,
      allowComments: false,
      schemas: [],
      enableSchemaRequest: false,
      trailingCommas: "error"
    });

    registerIdeActions(editor, monacoInstance);

    editor.onDidFocusEditorText(() => {
      hasTextFocusRef.current = true;
      setClockMonacoFocused(true);
    });
    editor.onDidFocusEditorWidget(() => setClockMonacoFocused(true));
    editor.onDidBlurEditorText(() => {
      hasTextFocusRef.current = false;
      setClockMonacoFocused(false);
    });
    editor.onDidBlurEditorWidget(() => setClockMonacoFocused(false));

    const host = hostRef.current;
    let detachBridge: (() => void) | undefined;
    if (host) {
      detachBridge = attachWindowShortcutBridge(host, () => editorRef.current);
    }

    editor.onDidDispose(() => {
      detachBridge?.();
      setClockMonacoFocused(false);
    });
  };

  // Sync externe (diagramme) → Monaco. Jamais pendant que l'utilisateur tape.
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    if (hasTextFocusRef.current) return;
    if (value === lastLocalValueRef.current) return;
    const model = editor.getModel();
    if (!model) return;
    if (model.getValue() === value) {
      lastLocalValueRef.current = value;
      return;
    }
    const position = editor.getPosition();
    const selections = editor.getSelections();
    model.setValue(value);
    lastLocalValueRef.current = value;
    if (selections) editor.setSelections(selections);
    else if (position) editor.setPosition(position);
  }, [value]);

  // Surlignage du nœud : décors à chaque sync, curseur seulement si le nœud sélectionné change
  useEffect(() => {
    const editor = editorRef.current;
    const monacoInstance = monacoRef.current;
    if (!editor || !monacoInstance) return;

    decorationRef.current = editor.deltaDecorations(decorationRef.current, []);
    if (!focusRange || focusRange.startLine <= 0 || focusRange.endLine <= 0) {
      lastJumpedNodeRef.current = selectedNodeId ?? null;
      return;
    }

    decorationRef.current = editor.deltaDecorations([], [
      {
        range: new monacoInstance.Range(focusRange.startLine, 1, focusRange.endLine, 1),
        options: {
          isWholeLine: true,
          className: "clock-json-highlight",
          linesDecorationsClassName: "clock-json-highlight-line"
        }
      }
    ]);

    const nodeChanged = (selectedNodeId ?? null) !== lastJumpedNodeRef.current;
    lastJumpedNodeRef.current = selectedNodeId ?? null;
    if (!nodeChanged || hasTextFocusRef.current) {
      return;
    }
    editor.revealLineInCenter(focusRange.startLine);
    editor.setPosition({ lineNumber: focusRange.startLine, column: 1 });
  }, [focusRange, selectedNodeId]);

  return (
    <div
      ref={hostRef}
      className="clock-monaco-host nokey h-full w-full overflow-hidden rounded-md border border-gray-200 bg-white dark:border-slate-700 dark:bg-[#16181d]"
      data-monaco-ide="true"
      onMouseDown={() => {
        editorRef.current?.focus();
        setClockMonacoFocused(true);
      }}
    >
      <Editor
        height="100%"
        defaultLanguage="json"
        theme={darkMode ? "vs-dark" : "vs"}
        defaultValue={value}
        onMount={handleMount}
        onChange={(next) => {
          const text = next ?? "";
          lastLocalValueRef.current = text;
          onChangeRef.current(text);
        }}
        options={{
          minimap: { enabled: true },
          fontSize: 13,
          fontFamily: "Cascadia Code, Consolas, 'Courier New', monospace",
          fontLigatures: true,
          lineHeight: 20,
          scrollBeyondLastLine: false,
          automaticLayout: true,
          wordWrap: "on",
          wrappingIndent: "indent",
          padding: { top: 12, bottom: 12 },
          contextmenu: true,
          readOnly: false,
          domReadOnly: false,
          tabSize: 2,
          insertSpaces: true,
          detectIndentation: false,
          autoIndent: "advanced",
          formatOnPaste: false,
          formatOnType: false,
          autoClosingBrackets: "always",
          autoClosingQuotes: "always",
          matchBrackets: "always",
          bracketPairColorization: { enabled: true },
          guides: { bracketPairs: true, indentation: true },
          multiCursorModifier: "alt",
          mouseWheelZoom: true,
          quickSuggestions: { other: true, comments: false, strings: true },
          suggestOnTriggerCharacters: true,
          acceptSuggestionOnEnter: "on",
          tabCompletion: "on",
          wordBasedSuggestions: "currentDocument",
          folding: true,
          foldingStrategy: "indentation",
          find: {
            addExtraSpaceOnTop: false,
            autoFindInSelection: "multiline",
            seedSearchStringFromSelection: "selection"
          },
          renderLineHighlight: "line",
          renderWhitespace: "selection",
          smoothScrolling: true,
          stickyScroll: { enabled: true },
          ariaLabel: "Éditeur JSON — Go to Symbol, Change All, Format, Cut/Copy/Paste, F1"
        }}
      />
    </div>
  );
}
