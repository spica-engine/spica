import {Button, FluidContainer, Icon, Modal, Popover, Text} from "oziko-ui-kit";
import {memo, useCallback, useEffect, useMemo, useRef, useState} from "react";
import styles from "./BucketRules.module.scss";
import Editor from "@monaco-editor/react";
import * as monaco from "monaco-editor";
import useLocalStorage from "../../../hooks/useLocalStorage";
import {jwtDecode} from "jwt-decode";
import type {AuthTokenJWTPayload} from "src/types/auth";
import type {BucketType} from "src/services/bucketService";
import {useBucket} from "../../../contexts/BucketContext";

type EditorFormProps = {
  bucket: BucketType;
  handleClose: () => void;
};

type BucketRulesProps = {
  bucket: BucketType;
  onClose: () => void;
};

const LANGUAGE_NAME = "myLang";
const THEME_NAME = "myCustomtheme";

function shortenErrorMessage(message: string, maxTokens = 5): string {
  const regex = /Expected\s+(.*?)\s+but\s+"(.)"\s+found\./;
  const match = message.match(regex);

  if (!match) return message;

  const expectedPart = match[1];
  const foundChar = match[2];

  // Extract all expected tokens (quoted strings or character classes)
  const tokens = [...expectedPart.matchAll(/"[^"]+"|\[[^\]]+\]/g)].map(m => m[0]);

  if (tokens.length <= maxTokens) return message;

  const shortenedTokens = tokens.slice(0, maxTokens).join(", ");
  const hiddenCount = tokens.length - maxTokens;

  return message.replace(
    regex,
    `Expected ${shortenedTokens} ...${hiddenCount} more, but "${foundChar}" found.`
  );
}

const parseRulesFromText = (text: string) => {
  if (!text.trim().startsWith("{") || !text.trim().endsWith("}")) {
    throw new Error("Input must be wrapped in curly braces.");
  }

  const rules = {write: "", read: ""};
  const knownKeys = new Set(["read", "write"]);
  const usedKeys = new Set<string>();

  const pairs = [];
  let i = 0;

  while (i < text.length) {
    if (/[\s{},]/.test(text[i])) {
      i++;
      continue;
    }

    const keyMatch = text.substring(i).match(/^(\w+)\s*:/);
    if (!keyMatch) {
      throw new Error(`Unexpected token at position ${i}: "${text[i]}"`);
    }

    const key = keyMatch[1];
    if (!knownKeys.has(key)) {
      throw new Error(`Unknown key: "${key}"`);
    }

    if (usedKeys.has(key)) {
      throw new Error(`Duplicate key: "${key}"`);
    }

    usedKeys.add(key);
    i += keyMatch[0].length;

    while (i < text.length && /\s/.test(text[i])) {
      i++;
    }

    let value = "";
    let braceCount = 0;
    let parenCount = 0;
    let inString = false;
    let stringChar = "";

    const startPos = i;

    while (i < text.length) {
      const char = text[i];

      if (!inString) {
        if (char === '"' || char === "'") {
          inString = true;
          stringChar = char;
        } else if (char === "(") {
          parenCount++;
        } else if (char === ")") {
          parenCount--;
        } else if (char === "{") {
          braceCount++;
        } else if (char === "}") {
          if (braceCount === 0) break;
          braceCount--;
        } else if (char === "," && braceCount === 0 && parenCount === 0) {
          break;
        } else if (braceCount === 0 && parenCount === 0) {
          const nextKeyMatch = text.substring(i).match(/^\s*\w+\s*:/);
          if (nextKeyMatch) {
            break;
          }
        }
      } else {
        if (char === stringChar && text[i - 1] !== "\\") {
          inString = false;
          stringChar = "";
        }
      }

      i++;
    }

    value = text.substring(startPos, i).trim().replace(/,$/, "");
    rules[key as "read" | "write"] = value;

    pairs.push({key, value});

    // Skip trailing comma
    if (text[i] === ",") i++;
  }

  // Check for leftover junk
  const remaining = text.slice(i).trim();
  if (remaining.length > 0) {
    throw new Error(`Unexpected extra content after parsing: "${remaining}"`);
  }

  return rules;
};

function handleEditorWillMount(
  monaco: typeof import("monaco-editor"),
  autoCompleteSuggestions: {
    document: any;
    auth: any;
  },
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

const EditorForm = ({bucket, handleClose}: EditorFormProps) => {
  const [error, setError] = useState<string | null>(null);
  const [value, setValue] = useState<string>(`{ 
    read: ${bucket.acl.read},
    write: ${bucket.acl.write}
}`);

  const {
    updateBucketRule,
    updateBucketRuleLoading: loading,
    updateBucketRuleError: apiError
  } = useBucket();

  const [token] = useLocalStorage("token", "");

  const disposableRef = useRef<monaco.IDisposable | null>(null);
  const initializedRef = useRef(false);

  const suggestions = useMemo(() => {
    const auth = jwtDecode<AuthTokenJWTPayload>(token);

    return {
      auth,
      document: {
        ...bucket.properties,
        _id: bucket._id
      }
    };
  }, [bucket, token]);

  useEffect(() => {
    setError(apiError);
  }, [apiError]);

  useEffect(() => {
    setError(null);
  }, []);

  useEffect(() => {
    return () => {
      disposableRef.current?.dispose?.();
      disposableRef.current = null;
    };
  }, []);

  const handleSubmit = useCallback(
    (value: string) => {
      try {
        const rules = parseRulesFromText(value);

        if (rules.read === undefined || rules.write === undefined) {
          console.error("Could not parse read or write rules");
          setError("Could not parse read or write rules");
          return;
        }

        updateBucketRule(bucket, {
          write: rules.write,
          read: rules.read
        }).then(result => {
          if (result) {
            handleClose();
            return;
          }

          console.error("Failed to change bucket rules");
          setError("Failed to change bucket rules");
        });
      } catch (error) {
        console.error("Error parsing rules:", error);
        setError(`Error parsing rules: ${error instanceof Error ? error.message : String(error)}`);
      }
    },
    [bucket, updateBucketRule, handleClose]
  );

  return (
    <div className={styles.body}>
      <div className={styles.editorContainer}>
        <Editor
          defaultLanguage={LANGUAGE_NAME}
          theme={THEME_NAME}
          value={value}
          onChange={val => setValue(val as string)}
          className={styles.editor}
          beforeMount={monaco =>
            handleEditorWillMount(monaco, suggestions, {
              disposableRef,
              initializedRef
            })
          }
          options={{
            lineNumbers: "off",
            renderLineHighlight: "none",
            overviewRulerLanes: 0,
            minimap: {enabled: false},
            glyphMargin: false,
            folding: false,
            lineDecorationsWidth: 0,
            fontSize: 14,
            lineHeight: 14,
            insertSpaces: true,
            detectIndentation: false,
            fontFamily: "var(--font-family-base)",
            // @ts-expect-error - Monaco types issue
            renderIndentGuides: false,
            suggestLineHeight: 20,
            scrollBeyondLastLine: false,
            wordBasedSuggestions: "off",
            scrollbar: {
              verticalScrollbarSize: 3,
              horizontalScrollbarSize: 3,
              useShadows: false
            },
            stickyScroll: {
              enabled: false
            }
          }}
        />
        {error && (
          <Text variant="danger" className={styles.errorText}>
            {shortenErrorMessage(error)}
          </Text>
        )}
      </div>

      <div className={styles.buttonsContainer}>
        <Button variant="text" onClick={handleClose} disabled={loading}>
          <Icon name="close" size="sm" />
          Cancel
        </Button>

        <Button disabled={loading} loading={loading} onClick={() => handleSubmit(value)}>
          <Icon name="filter" size="sm" />
          Apply
        </Button>
      </div>
    </div>
  );
};

const BucketRules = ({bucket, onClose}: BucketRulesProps) => {
  return (
    <Modal onClose={onClose} className={styles.container} isOpen showCloseButton={false}>
      <Modal.Body className={styles.contentContainer}>
        <FluidContainer
          direction="vertical"
          gap={0}
          className={styles.headerContainer}
          prefix={{
            children: (
              <div className={styles.header}>
                <Text className={styles.headerText}>RULES</Text>
                <a
                  href="https://spicaengine.com/docs/concept/bucket#rules"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Icon name="help" size="md" className={styles.helpIcon} />
                </a>
              </div>
            )
          }}
          suffix={{
            children: <EditorForm bucket={bucket} handleClose={onClose} />
          }}
        />
      </Modal.Body>
    </Modal>
  );
};

export default memo(BucketRules);
