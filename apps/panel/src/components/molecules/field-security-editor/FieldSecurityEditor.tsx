import {FlexElement, Icon, ListItem, Select, Text, type TypeValue} from "oziko-ui-kit";
import Editor from "@monaco-editor/react";
import {memo, useCallback, useMemo, type FC} from "react";
import styles from "./FieldSecurityEditor.module.scss";
import {buildAclExpression, type FieldAclMode, type FieldSecurity} from "../../../domain/fields/field-acl";
import type {Properties} from "../../../store/api/bucketApi";
import {useRuleEditor} from "../../../hooks/useRuleEditor";

export type {FieldSecurity} from "../../../domain/fields/field-acl";

type FieldSecurityEditorProps = {
  value?: FieldSecurity;
  bucketProperties: Properties;
  onChange: (next: FieldSecurity) => void;
  className?: string;
};

const MODE_OPTIONS: {mode: FieldAclMode; label: string; description: string}[] = [
  {
    mode: "everyone",
    label: "Everyone",
    description: "No rule — the field's value is always returned."
  },
  {
    mode: "authenticated",
    label: "Signed-in users only",
    description: "Only requests carrying an identity can read this field."
  },
  {
    mode: "owner",
    label: "Only the record owner",
    description: "Only the identity referenced by the chosen field can read it."
  },
  {
    mode: "custom",
    label: "Custom rule",
    description: "Write your own expression over auth.* and document.*."
  }
];

const DEFAULT_VALUE: FieldSecurity = {mode: "everyone", expression: ""};

// Ghost guidance shown over the empty custom editor. Each line is a real, valid
// expression: `auth.*` reasons about the requester, `document.*` about the row.
const CUSTOM_EXAMPLES = [
  "document.age > 24",
  "auth.identifier == 'admin'",
  `"HR" in auth.policies`,
  "document.owner == auth._id"
];

const EDITOR_OPTIONS = {
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
  suggestLineHeight: 20,
  scrollBeyondLastLine: false,
  wordBasedSuggestions: "off",
  scrollbar: {
    verticalScrollbarSize: 3,
    horizontalScrollbarSize: 3,
    useShadows: false
  },
  stickyScroll: {enabled: false}
} as const;

const FieldSecurityEditor: FC<FieldSecurityEditorProps> = ({
  value = DEFAULT_VALUE,
  bucketProperties,
  onChange,
  className
}) => {
  const propertyKeys = useMemo(() => Object.keys(bucketProperties ?? {}), [bucketProperties]);

  const {language, theme, beforeMount} = useRuleEditor({properties: bucketProperties});

  const handleModeChange = useCallback(
    (mode: FieldAclMode) => {
      if (mode === value.mode) return;

      if (mode === "owner") {
        const ownerField = value.ownerField || propertyKeys[0];
        onChange({
          mode,
          ownerField,
          expression: buildAclExpression({mode, ownerField, expression: ""}) ?? value.expression
        });
        return;
      }

      // Custom keeps whatever preset expression was last shown so it stays editable.
      if (mode === "custom") {
        onChange({mode, expression: value.expression, ownerField: value.ownerField});
        return;
      }

      // Everyone / authenticated: mirror the canonical expression for display.
      onChange({
        mode,
        expression: buildAclExpression({mode, expression: value.expression}) ?? "",
        ownerField: value.ownerField
      });
    },
    [value, propertyKeys, onChange]
  );

  const handleOwnerFieldChange = useCallback(
    (next: TypeValue) => {
      const ownerField = String(next);
      onChange({
        mode: "owner",
        ownerField,
        expression: buildAclExpression({mode: "owner", ownerField, expression: ""}) ?? ""
      });
    },
    [onChange]
  );

  const handleExpressionChange = useCallback(
    (expression?: string) => {
      onChange({mode: "custom", expression: expression ?? "", ownerField: value.ownerField});
    },
    [onChange, value.ownerField]
  );

  return (
    <FlexElement
      direction="vertical"
      gap={10}
      dimensionX="fill"
      className={`${styles.fieldSecurityEditor} ${className ?? ""}`}
    >
      <FlexElement direction="vertical" gap={0} dimensionX="fill" className={styles.options}>
        {MODE_OPTIONS.map(option => (
          <ListItem
            key={option.mode}
            label={option.label}
            active={option.mode === value.mode}
            dimensionX="fill"
            className={styles.option}
            onClick={() => handleModeChange(option.mode)}
            prefix={{
              children: (
                <Icon
                  name={option.mode === value.mode ? "check" : "checkboxBlankOutline"}
                  size="sm"
                />
              )
            }}
            suffix={{
              children: <Text className={styles.optionDescription}>{option.description}</Text>
            }}
          />
        ))}
      </FlexElement>

      {value.mode === "owner" && (
        <FlexElement direction="vertical" gap={5} dimensionX="fill" className={styles.body}>
          <Text className={styles.label}>Owner field</Text>
          <Select
            dimensionX="fill"
            options={propertyKeys}
            value={value.ownerField ?? undefined}
            onChange={handleOwnerFieldChange}
            placeholder="Select a field"
          />
        </FlexElement>
      )}

      {value.mode === "custom" && (
        <div className={styles.editorContainer}>
          <Editor
            defaultLanguage={language}
            theme={theme}
            value={value.expression}
            onChange={handleExpressionChange}
            className={styles.editor}
            beforeMount={beforeMount}
            loading={<div className={styles.editorLoadingSkeleton} />}
            options={EDITOR_OPTIONS}
          />
          {!value.expression.trim() && (
            <div className={styles.editorPlaceholder} aria-hidden="true">
              {CUSTOM_EXAMPLES.map(example => (
                <div key={example} className={styles.editorPlaceholderLine}>
                  {example}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <Text className={styles.note}>
        Field rules apply only to end-user (USER) API calls. Identity & API-key access ignore them.
      </Text>
    </FlexElement>
  );
};

export default memo(FieldSecurityEditor);
