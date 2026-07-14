import {useCallback, useEffect, useMemo, useRef} from "react";
import * as monaco from "monaco-editor";
import {jwtDecode} from "jwt-decode";
import type {AuthTokenJWTPayload} from "src/types/auth";

/**
 * Shared Monaco setup for Spica rule expressions (bucket ACL rules and
 * field-level ACL). Both editors speak the same tiny language: bare expressions
 * over `auth.*` (the requesting identity) and `document.*` (the row). Keeping the
 * language registration, theme and `auth.*`/`document.*` completion provider in
 * one place means the bucket-rules modal and the field security editor can never
 * drift apart.
 */

const LANGUAGE_NAME = "myLang";
const THEME_NAME = "myCustomtheme";

type RuleEditorSuggestions = {
  document: any;
  auth: any;
};

function registerRuleEditor(
  monaco: typeof import("monaco-editor"),
  autoCompleteSuggestions: RuleEditorSuggestions,
  refs: {
    disposableRef: React.RefObject<monaco.IDisposable | null>;
    initializedRef: React.RefObject<boolean>;
  }
) {
  const {disposableRef, initializedRef} = refs;

  if (!initializedRef.current) {
    monaco.languages.register({id: LANGUAGE_NAME});

    monaco.languages.setMonarchTokensProvider(LANGUAGE_NAME, {
      defaultToken: "",
      tokenizer: {
        root: [
          [/[a-zA-Z_$][\w$]*\s*:/, "key"],
          [/[{}]/, "delimiter.bracket"],
          {include: "@common"}
        ],
        common: [
          [/\d+/, "number"],
          [/[,.]/, "delimiter"],
          [/[;]/, "delimiter"],
          [/"([^"\\]|\\.)*$/, "string.invalid"],
          [/"([^"\\]|\\.)*"/, "string"],
          [/'([^'\\]|\\.)*$/, "string.invalid"],
          [/'([^'\\]|\\.)*'/, "string"],
          [/\s+/, "white"]
        ]
      }
    });

    monaco.editor.defineTheme(THEME_NAME, {
      base: "vs",
      inherit: true,
      rules: [
        {token: "key", foreground: "000000", fontStyle: "bold"},
        {token: "identifier", foreground: "000000"},
        {token: "delimiter", foreground: "000000"},
        {token: "string", foreground: "000000"}
      ],

      colors: {
        "editor.background": "#f4f4f4"
      }
    });

    initializedRef.current = true;
  }

  disposableRef.current = monaco.languages.registerCompletionItemProvider(LANGUAGE_NAME, {
    triggerCharacters: ".".split(""),

    provideCompletionItems: (model, position) => {
      const textUntilPosition = model.getValueInRange({
        startLineNumber: position.lineNumber,
        startColumn: 1,
        endLineNumber: position.lineNumber,
        endColumn: position.column
      });

      const statements = textUntilPosition
        .split(/;|,| /)
        .map(s => s.trim())
        .filter(Boolean);
      const lastStatement = statements.length > 0 ? statements[statements.length - 1] : "";

      const cleaned = lastStatement.replace(/^(read|write)\s*:\s*/, "");

      const suggestions: monaco.languages.CompletionItem[] = [];
      const seen = new Set<string>();
      if (!cleaned.includes(".")) {
        const baseWords = ["true", "false", "auth", "document"];
        const word = cleaned.split(/\s+/).pop() ?? "";

        for (const key of baseWords) {
          if (key.startsWith(word)) {
            if (seen.has(key)) continue;
            seen.add(key);
            suggestions.push({
              label: key,
              kind: monaco.languages.CompletionItemKind.Keyword,
              insertText: key
            } as monaco.languages.CompletionItem);
          }
        }

        return {suggestions} as monaco.languages.CompletionList;
      }

      const lastDotIndex = cleaned.lastIndexOf(".");
      const basePath = cleaned.slice(0, lastDotIndex);
      const partial = cleaned.slice(lastDotIndex + 1);

      const pathSegments = basePath.split(".");
      const root = pathSegments.shift();
      if (!root || !["auth", "document"].includes(root)) return {suggestions: []};

      let current = autoCompleteSuggestions[root as "auth" | "document"];
      for (const segment of pathSegments) {
        if (!current || typeof current !== "object") return {suggestions: []};
        current = current[segment];
      }

      if (!current || typeof current !== "object") return {suggestions: []};

      for (const key of Object.keys(current)) {
        if (seen.has(key)) continue;
        if (key.startsWith(partial)) {
          seen.add(key);
          suggestions.push({
            label: key,
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: key,
            detail: `${root} property`
          } as monaco.languages.CompletionItem);
        }
      }

      return {suggestions} as monaco.languages.CompletionList;
    }
  });
}

type UseRuleEditorParams = {
  /** Bucket properties powering `document.*` completions. */
  properties: Record<string, any> | undefined;
  /** Row id exposed as `document._id` in completions, when known. */
  documentId?: string;
};

export function useRuleEditor({properties, documentId}: UseRuleEditorParams) {
  const disposableRef = useRef<monaco.IDisposable | null>(null);
  const initializedRef = useRef(false);

  // The auth token is persisted as a RAW JWT string (Authorization: IDENTITY <token>),
  // not JSON — so it must be read directly, not through useLocalStorage (which JSON.parses).
  // A missing/garbage token must degrade to {} so autocomplete stops suggesting auth.*
  // instead of throwing InvalidTokenError and crashing the whole editor.
  const auth = useMemo<Partial<AuthTokenJWTPayload>>(() => {
    try {
      const raw = typeof window !== "undefined" ? window.localStorage.getItem("token") : null;
      return raw ? jwtDecode<AuthTokenJWTPayload>(raw) : {};
    } catch {
      return {};
    }
  }, []);

  const suggestions = useMemo<RuleEditorSuggestions>(
    () => ({
      auth,
      document: documentId !== undefined ? {...properties, _id: documentId} : {...properties}
    }),
    [properties, auth, documentId]
  );

  useEffect(() => {
    return () => {
      disposableRef.current?.dispose?.();
      disposableRef.current = null;
    };
  }, []);

  const beforeMount = useCallback(
    (monacoInstance: typeof import("monaco-editor")) =>
      registerRuleEditor(monacoInstance, suggestions, {disposableRef, initializedRef}),
    [suggestions]
  );

  return {language: LANGUAGE_NAME, theme: THEME_NAME, beforeMount};
}
