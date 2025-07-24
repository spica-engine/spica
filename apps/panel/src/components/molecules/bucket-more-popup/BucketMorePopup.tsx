import {Button, FluidContainer, Icon, Popover, Text} from "oziko-ui-kit";
import {memo, useEffect, useMemo, useRef, useState} from "react";
import styles from "./BucketMorePopup.module.scss";
import Editor from "@monaco-editor/react";
import * as monaco from "monaco-editor";
import useLocalStorage from "../../../hooks/useLocalStorage";
import {jwtDecode} from "jwt-decode";
import type {AuthTokenJWTPayload} from "src/types/auth";
import useApi from "../../../hooks/useApi";
import type {BucketType} from "src/services/bucketService";

type EditorFormProps = {
  bucket: BucketType;
  handleClose: () => void;
};

type BucketMorePopupProps = {
  bucket: BucketType;
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
    monaco.languages.register({id: "myLang"});

    monaco.languages.setMonarchTokensProvider("myLang", {
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

    monaco.editor.defineTheme("my-custom-theme", {
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

  disposableRef.current = monaco.languages.registerCompletionItemProvider("myLang", {
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

function handleEditerMounted(editor: monaco.editor.IStandaloneCodeEditor) {
  const model = editor.getModel();
  if (!model) {
    console.error("error while getting model");
    return;
  }

  let lastValue = model.getValue();
  let isReverting = false;
  const initialLineCount = model.getLineCount();

  editor.onDidChangeModelContent(e => {
    if (isReverting) return;
    const change = e.changes[0];
    const newLineCount = model.getLineCount();

    const shouldBlock =
      change.range.startLineNumber === 1 ||
      change.range.startLineNumber >= 4 ||
      (change.range.startLineNumber === 2 && change.range.startColumn <= 9) ||
      (change.range.startLineNumber === 3 && change.range.startColumn <= 10) ||
      newLineCount !== initialLineCount;

    if (shouldBlock) {
      const selection = editor.getSelection();
      if (!selection) return;
      isReverting = true;
      model.setValue(lastValue);
      editor.setSelection(selection);
      isReverting = false;
      return;
    }

    lastValue = model.getValue();
  });
}

const EditorForm = ({bucket, handleClose}: EditorFormProps) => {
  const {request} = useApi({
    endpoint: `/api/bucket/${bucket._id}`,
    method: "put"
  });
  const [value, setValue] = useState<string>(`{ 
    read: ${bucket.acl.read}
    write: ${bucket.acl.write}
}`);

  const [token] = useLocalStorage("token", "");

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

  const handleSubmit = () => {
    const lines = value.split("\n");
    const read = lines[1].trim().slice(5).trim(); // "read:".length
    const write = lines[2].trim().slice(6).trim(); // "write:".length
    request({body: {...bucket, acl: {write, read}}});
  };

  const disposableRef = useRef<monaco.IDisposable | null>(null);
  const initializedRef = useRef(false); // tracks global setup (theme, language, etc.)

  useEffect(() => {
    return () => {
      disposableRef.current?.dispose?.();
      disposableRef.current = null;
    };
  }, []);

  return (
    <div className={styles.body}>
      <div className={styles.editorContainer}>
        <Editor
          defaultLanguage="myLang"
          theme="my-custom-theme"
          beforeMount={monaco =>
            handleEditorWillMount(monaco, suggestions, {disposableRef, initializedRef})
          }
          onMount={handleEditerMounted}
          options={{
            lineNumbers: "off",
            renderLineHighlight: "none",
            overviewRulerLanes: 0,
            minimap: {enabled: false},
            glyphMargin: false,
            folding: false,
            lineDecorationsWidth: 0,
            fontSize: 14,
            lineHeight: 12,
            insertSpaces: true,
            detectIndentation: false,
            fontFamily: "var(--font-family-base)",
            //@ts-expect-error
            renderIndentGuides: false,
            suggestLineHeight: 20,
            scrollBeyondLastLine: false,
            wordBasedSuggestions: "off"
          }}
          className={styles.editor}
          value={value}
          onChange={val => setValue(val as string)}
        />
      </div>
      <div className={styles.buttonsContainer}>
        <Button variant="text" onClick={handleClose}>
          <Icon name="close" size="sm" />
          Cancel
        </Button>
        <Button onClick={handleSubmit}>
          <Icon name="filter" size="sm" />
          Apply
        </Button>
      </div>
    </div>
  );
};

const BucketMorePopup = ({bucket}: BucketMorePopupProps) => {
  const [open, setOpen] = useState(false);

  return (
    <Popover
      containerProps={{className: styles.popupContainer}}
      contentProps={{className: styles.contentContainer}}
      open={open}
      content={
        <FluidContainer
          direction="vertical"
          className={styles.headerContainer}
          prefix={{
            children: (
              <div className={styles.header}>
                <Text className={styles.headerText}>RULES</Text>
                <Icon name="help" size="md" />
              </div>
            )
          }}
          suffix={{
            children: <EditorForm bucket={bucket} handleClose={() => setOpen(false)} />
          }}
        />
      }
    >
      <Button color="default" onClick={() => setOpen(true)}>
        <Icon name="dotsVertical" />
        More
      </Button>
    </Popover>
  );
};

export default memo(BucketMorePopup);
