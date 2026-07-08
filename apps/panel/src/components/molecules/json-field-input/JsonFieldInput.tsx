import React, {useCallback, useEffect, useRef, useState} from "react";
import Editor from "@monaco-editor/react";
import type {editor} from "monaco-editor";
import type {TypeChangeEvent} from "oziko-ui-kit/dist/custom-hooks/useInputRepresenter";
import styles from "./JsonFieldInput.module.scss";

const JSON_EDITOR_LANGUAGE = "json";
const JSON_INDENT_SPACES = 2;

interface JsonFieldInputProps {
  fieldKey: string;
  title: string;
  description?: string;
  value?: any;
  className?: string;
  onChange?: (event: TypeChangeEvent<any>) => void;
}

const valueToText = (value: any): string => {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, JSON_INDENT_SPACES);
  } catch {
    // A circular structure makes JSON.stringify throw; String(value) would then leak
    // the literal "[object Object]", so fall back to a neutral placeholder.
    return Array.isArray(value) ? "[…]" : "{…}";
  }
};

const parseJson = (text: string): {success: boolean; value?: any; error?: string} => {
  if (!text.trim()) return {success: true, value: null};
  try {
    return {success: true, value: JSON.parse(text)};
  } catch (error) {
    return {success: false, error: error instanceof Error ? error.message : "Invalid JSON"};
  }
};

const sameJson = (a: any, b: any): boolean => {
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return a === b;
  }
};

const editorOptions: editor.IStandaloneEditorConstructionOptions = {
  minimap: {enabled: false},
  scrollBeyondLastLine: false,
  wordWrap: "on",
  formatOnPaste: true,
  formatOnType: true,
  lineNumbers: "on",
  folding: true,
  automaticLayout: true
};

// Free-form JSON editor bound to the entry form. Only valid JSON is written back
// into form state, so an in-progress or malformed edit can never be submitted;
// the syntax error is surfaced inline instead.
const JsonFieldInput: React.FC<JsonFieldInputProps> = ({
  fieldKey,
  title,
  value,
  className,
  onChange
}) => {
  const [text, setText] = useState<string>(() => valueToText(value));
  const [error, setError] = useState<string | null>(null);
  // Tracks the last value we emitted so an async prefill (edit mode) reseeds the
  // editor while our own echo does not clobber what the user is typing.
  const lastEmittedRef = useRef<any>(value);

  useEffect(() => {
    if (sameJson(value, lastEmittedRef.current)) return;
    lastEmittedRef.current = value;
    setText(valueToText(value));
    setError(null);
  }, [value]);

  const handleChange = useCallback(
    (next: string | undefined = "") => {
      setText(next);
      const result = parseJson(next);
      if (!result.success) {
        setError(result.error || "Invalid JSON");
        return;
      }
      setError(null);
      lastEmittedRef.current = result.value;
      onChange?.({key: fieldKey, value: result.value});
    },
    [fieldKey, onChange]
  );

  return (
    <div className={`${styles.jsonFieldInput} ${className ?? ""}`}>
      {title && <label className={styles.label}>{title}</label>}
      <div className={styles.editorWrapper}>
        <Editor
          defaultLanguage={JSON_EDITOR_LANGUAGE}
          value={text}
          onChange={handleChange}
          options={editorOptions}
        />
      </div>
      {error && <span className={styles.error}>{error}</span>}
    </div>
  );
};

export default JsonFieldInput;
