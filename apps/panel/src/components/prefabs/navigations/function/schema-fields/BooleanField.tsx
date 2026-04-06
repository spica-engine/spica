import {FlexElement, Text} from "oziko-ui-kit";
import {useSchemaFieldContext} from "./SchemaFieldContext";
import type {SchemaFieldProps, SchemaFieldRenderer} from "./types";

const BooleanField = ({fieldKey, label, value, onChange}: SchemaFieldProps) => {
  const {styles} = useSchemaFieldContext();

  return (
    <FlexElement
      key={fieldKey}
      dimensionX="fill"
      gap={8}
      alignment="leftCenter"
      className={styles.checkboxRow}
    >
      <input
        type="checkbox"
        checked={value ?? false}
        onChange={e => onChange(e.target.checked)}
        id={`trigger-opt-${fieldKey}`}
      />
      <label htmlFor={`trigger-opt-${fieldKey}`}>
        <Text size="small" className={styles.fieldLabel}>
          {label}
        </Text>
      </label>
    </FlexElement>
  );
};

export const booleanFieldRenderer: SchemaFieldRenderer = {
  match: schema => schema.type === "boolean",
  Component: BooleanField
};
