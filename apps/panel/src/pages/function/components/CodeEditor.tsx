/**
 * @owner Kanan Gasimov
 * email: rio.kenan@gmail.com
 */

import {memo, useCallback, useEffect, useRef} from "react";
import Editor, {type OnMount, type Monaco} from "@monaco-editor/react";
import type {editor} from "monaco-editor";

type ExtraLibs = Record<string, string>;

type CodeEditorProps = {
  value: string;
  language: "javascript" | "typescript";
  onChange: (value: string) => void;
  onSave?: () => void;
  readOnly?: boolean;
  functionId?: string;
  extraLibs?: ExtraLibs;
};

const editorOptions: editor.IStandaloneEditorConstructionOptions = {
  minimap: {enabled: false},
  automaticLayout: true,
  scrollBeyondLastLine: false,
  wordWrap: "on",
  formatOnPaste: true,
  formatOnType: true,
  lineNumbers: "on",
  folding: true,
  scrollbar: {alwaysConsumeMouseWheel: false},
  fontSize: 14,
  tabSize: 2,
};

const CodeEditor = ({value, language, onChange, onSave, readOnly, functionId, extraLibs}: CodeEditorProps) => {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;
  const extraLibDisposablesRef = useRef<{dispose(): void}[]>([]);

  const handleBeforeMount = useCallback((monaco: Monaco) => {
    const bg = getComputedStyle(document.documentElement)
      .getPropertyValue("--color-layout-background")
      .trim() || "#ffffff";

    monaco.editor.defineTheme("custom-light", {
      base: "vs",
      inherit: true,
      rules: [],
      colors: {
        "editor.background": bg,
      },
    });

    monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
      allowNonTsExtensions: true,
      moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
    });
    monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
      allowNonTsExtensions: true,
      moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
    });
  }, []);

  const handleMount: OnMount = useCallback((editorInstance, monaco) => {
    editorRef.current = editorInstance;
    monacoRef.current = monaco;

    editorInstance.addAction({
      id: "save-function-index",
      label: "Save",
      keybindings: [2048 | 49], // Ctrl/Cmd + S
      run: () => onSaveRef.current?.(),
    });
  }, []);

  useEffect(() => {
    const monaco = monacoRef.current;
    if (!monaco || !extraLibs) return;

    extraLibDisposablesRef.current.forEach(d => d.dispose());
    extraLibDisposablesRef.current = [];

    for (const [id, sourceCode] of Object.entries(extraLibs)) {
      const libPath = `file:///${id}/.build/index.js`;
      extraLibDisposablesRef.current.push(
        monaco.languages.typescript.javascriptDefaults.addExtraLib(sourceCode, libPath),
        monaco.languages.typescript.typescriptDefaults.addExtraLib(sourceCode, libPath),
      );
    }

    return () => {
      extraLibDisposablesRef.current.forEach(d => d.dispose());
      extraLibDisposablesRef.current = [];
    };
  }, [extraLibs]);

  const handleChange = useCallback(
    (newValue: string | undefined) => {
      onChange(newValue ?? "");
    },
    [onChange]
  );

  return (
    <Editor
      height="100%"
      language={language}
      path="file:///main.tsx"
      value={value}
      onChange={handleChange}
      beforeMount={handleBeforeMount}
      onMount={handleMount}
      options={{...editorOptions, readOnly}}
      theme="custom-light"
    />
  );
};

export default memo(CodeEditor);
export {type CodeEditorProps};
