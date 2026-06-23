/**
 * @owner Kanan Gasimov
 * email: rio.kenan@gmail.com
 */

import {memo, useCallback, useEffect, useRef} from "react";
import Editor, {type OnMount, type Monaco} from "@monaco-editor/react";
import type {editor} from "monaco-editor";

function getMonacoThemeName(): string {
  return document.documentElement.getAttribute("data-theme") === "dark" ? "custom-dark" : "custom-light";
}

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
  scrollbar: {
    alwaysConsumeMouseWheel: false,
    vertical: "auto",
    horizontal: "auto",
    useShadows: false,
    verticalScrollbarSize: 5,
    horizontalScrollbarSize: 5,
  },
  fontSize: 12.5,
  fontFamily: "'JetBrains Mono', 'Courier New', monospace",
  lineHeight: 21,
  tabSize: 2,
};

const CodeEditor = ({value, language, onChange, onSave, readOnly, functionId, extraLibs}: CodeEditorProps) => {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;
  const extraLibDisposablesRef = useRef<{dispose(): void}[]>([]);

  const handleBeforeMount = useCallback((monaco: Monaco) => {
    // Use hardcoded token values so both themes are always correctly defined,
    // regardless of which mode is active at editor mount time.
    monaco.editor.defineTheme("custom-light", {
      base: "vs",
      inherit: true,
      rules: [],
      colors: {
        "editor.background": "#ffffff",
        "editor.foreground": "#111827",
      },
    });

    monaco.editor.defineTheme("custom-dark", {
      base: "vs-dark",
      inherit: true,
      rules: [],
      colors: {
        "editor.background": "#13181f",
        "editor.foreground": "#e4e8f2",
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

  // Live theme switching: watch data-theme attribute on <html>
  useEffect(() => {
    const observer = new MutationObserver(() => {
      const monaco = monacoRef.current;
      if (!monaco) return;
      monaco.editor.setTheme(getMonacoThemeName());
    });
    observer.observe(document.documentElement, {attributes: true, attributeFilter: ["data-theme"]});
    return () => observer.disconnect();
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
      path={`file:///${functionId || "default"}/index.tsx`}
      value={value}
      onChange={handleChange}
      beforeMount={handleBeforeMount}
      onMount={handleMount}
      options={{...editorOptions, readOnly}}
      theme={getMonacoThemeName()}
    />
  );
};

export default memo(CodeEditor);
export {type CodeEditorProps};
