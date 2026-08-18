import Editor, { type OnMount } from "@monaco-editor/react";
import type * as monaco from "monaco-editor";
import { useEffect, useRef } from "react";
import { useClockStore } from "../../store/clockStore";

type MonacoPanelProps = {
  value: string;
  onChange: (value: string) => void;
  focusRange?: { startLine: number; endLine: number } | null;
};

export function MonacoPanel({ value, onChange, focusRange }: MonacoPanelProps) {
  const darkMode = useClockStore((state) => state.darkMode);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof monaco | null>(null);
  const decorationRef = useRef<string[]>([]);

  const handleMount: OnMount = (editor, monacoInstance) => {
    editorRef.current = editor;
    monacoRef.current = monacoInstance;
  };

  useEffect(() => {
    const editor = editorRef.current;
    const monacoInstance = monacoRef.current;
    if (!editor || !monacoInstance) return;

    // Supprime les anciennes décorations
    decorationRef.current = editor.deltaDecorations(decorationRef.current, []);

    if (!focusRange || focusRange.startLine <= 0 || focusRange.endLine <= 0) return;

    // Décoration du bloc sélectionné
    decorationRef.current = editor.deltaDecorations([], [
      {
        range: new monacoInstance.Range(
          focusRange.startLine,
          1,
          focusRange.endLine,
          1
        ),
        options: {
          isWholeLine: true,
          className: "clock-json-highlight",
          linesDecorationsClassName: "clock-json-highlight-line"
        }
      }
    ]);

    editor.revealLineInCenter(focusRange.startLine);
    editor.setPosition({ lineNumber: focusRange.startLine, column: 1 });
    editor.focus();
  }, [focusRange]);

  return (
    <div className="h-full w-full overflow-hidden rounded-md border border-gray-200 bg-white">
      <Editor
        height="100%"
        defaultLanguage="json"
        theme={darkMode ? "vs-dark" : "vs"}
        value={value}
        onMount={handleMount}
        onChange={(v) => onChange(v ?? "")}
        options={{
          minimap: { enabled: true },
          fontSize: 13,
          lineHeight: 20,
          scrollBeyondLastLine: false,
          automaticLayout: true,
          roundedSelection: true,
          wordWrap: "on",
          padding: { top: 12, bottom: 12 }
        }}
      />
    </div>
  );
}