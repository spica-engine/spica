import {FlexElement, Icon, Input, Text} from "oziko-ui-kit";
import {useSchemaFieldContext} from "./SchemaFieldContext";
import type {SchemaFieldProps, SchemaFieldRenderer} from "./types";

const TextField = ({fieldKey, label, schema, value, onChange}: SchemaFieldProps) => {
  const {styles} = useSchemaFieldContext();

  const placeholder = schema.examples?.[0] ?? schema.description ?? "";

  return (
    <FlexElement key={fieldKey} direction="vertical" alignment="leftCenter" dimensionX="fill" gap={6}>
      <Text size="small" dimensionX="fill" className={styles.fieldLabel}>
        {label}
      </Text>
      <FlexElement gap={5} className={styles.inputContainer}>
        <Icon name="formatQuoteClose" size="md" />
        <Input
          placeholder={String(placeholder)}
          value={value ?? ""}
          onChange={e => onChange(e.target.value)}
          className={styles.input}
          type="text"
        />
      </FlexElement>
    </FlexElement>
  );
};

export const textFieldRenderer: SchemaFieldRenderer = {
  match: () => true,
  Component: TextField
};
