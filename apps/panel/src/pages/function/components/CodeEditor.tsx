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

  // Each function keeps its own Monaco model so its undo/redo stack is isolated:
  // switching functions must never let Cmd+Z resurrect another function's code.
  const modelsRef = useRef<Map<string, editor.ITextModel>>(new Map());
  const ownedModelsRef = useRef<Set<string>>(new Set());
  const suppressChangeRef = useRef(false);
  const functionIdRef = useRef(functionId);
  functionIdRef.current = functionId;
  const syncModelRef = useRef<() => void>(() => {});

  const syncModel = useCallback(() => {
    const editorInstance = editorRef.current;
    const monaco = monacoRef.current;
    if (!editorInstance || !monaco) return;

    const key = functionId || "default";

    let model = modelsRef.current.get(key);
    if (!model || model.isDisposed()) {
      const uri = monaco.Uri.parse(`file:///spica-function/${key}/index.tsx`);
      model = monaco.editor.getModel(uri) ?? monaco.editor.createModel(value, language, uri);
      modelsRef.current.set(key, model);
    }

    if (editorInstance.getModel() !== model) {
      editorInstance.setModel(model);
    }

    if (model.getValue() === value) return;

    suppressChangeRef.current = true;
    if (ownedModelsRef.current.has(key)) {
      // The user has edited this function: preserve its undo history and record
      // this external write (e.g. imports injected from the sidebar) as an
      // undoable step within the model.
      editorInstance.executeEdits("external", [
        {range: model.getFullModelRange(), text: value, forceMoveMarkers: true},
      ]);
      editorInstance.pushUndoStop();
    } else {
      // Fresh model, or one seeded from stale props during a function switch:
      // replace the content without adding an undo entry, so Cmd+Z on an
      // unedited function is a no-op instead of loading the previous code.
      model.setValue(value);
    }
    suppressChangeRef.current = false;
  }, [functionId, value, language]);
  syncModelRef.current = syncModel;

  useEffect(() => {
    syncModel();
  }, [syncModel]);

  useEffect(() => {
    const models = modelsRef.current;
    return () => {
      models.forEach(model => {
        if (!model.isDisposed()) model.dispose();
      });
      models.clear();
    };
  }, []);

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

    // Swap the wrapper's throwaway default model for this function's dedicated
    // model, then dispose the orphan so it does not leak.
    const initialModel = editorInstance.getModel();
    syncModelRef.current();
    if (initialModel && initialModel !== editorInstance.getModel() && !initialModel.isDisposed()) {
      initialModel.dispose();
    }
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
      // Ignore programmatic writes (seeding / external syncs) so they neither
      // notify the parent nor flag the model as user-owned.
      if (suppressChangeRef.current) return;
      ownedModelsRef.current.add(functionIdRef.current || "default");
      onChange(newValue ?? "");
    },
    [onChange]
  );

  return (
    <Editor
      height="100%"
      language={language}
      defaultValue=""
      keepCurrentModel
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
