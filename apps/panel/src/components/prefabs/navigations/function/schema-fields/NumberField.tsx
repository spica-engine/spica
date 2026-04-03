import {FlexElement, Icon, Input, Text} from "oziko-ui-kit";
import {useSchemaFieldContext} from "./SchemaFieldContext";
import type {SchemaFieldProps, SchemaFieldRenderer} from "./types";

const NumberField = ({fieldKey, label, schema, value, onChange}: SchemaFieldProps) => {
  const {styles} = useSchemaFieldContext();

  return (
    <FlexElement key={fieldKey} direction="vertical" alignment="leftCenter" dimensionX="fill" gap={6}>
      <Text size="small" dimensionX="fill" className={styles.fieldLabel}>
        {label}
      </Text>
      <FlexElement gap={5} className={styles.inputContainer}>
        <Icon name="formatQuoteClose" size="md" />
        <Input
          placeholder={schema.description ?? ""}
          value={value ?? ""}
          onChange={e => onChange(e.target.value === "" ? undefined : Number(e.target.value))}
          className={styles.input}
          type="number"
        />
      </FlexElement>
    </FlexElement>
  );
};

export const numberFieldRenderer: SchemaFieldRenderer = {
  match: schema => schema.type === "integer" || schema.type === "number",
  Component: NumberField
};
