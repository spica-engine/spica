import {FlexElement, Select, Text} from "oziko-ui-kit";
import {useSchemaFieldContext} from "./SchemaFieldContext";
import type {SchemaFieldProps, SchemaFieldRenderer} from "./types";

const ArrayEnumField = ({fieldKey, label, schema, value, onChange}: SchemaFieldProps) => {
  const {styles} = useSchemaFieldContext();

  const viewEnum = schema.items.viewEnum as string[] | undefined;
  const selectOptions = (schema.items.enum as string[]).map((val: string, i: number) => ({
    label: viewEnum?.[i] ?? val,
    value: val
  }));

  return (
    <FlexElement key={fieldKey} direction="vertical" alignment="leftCenter" dimensionX="fill" gap={6}>
      <Text size="small" dimensionX="fill" className={styles.fieldLabel}>
        {label}
      </Text>
      <Select
        options={selectOptions}
        value={value ?? []}
        onChange={v => onChange(v)}
        multiple
        dimensionX="fill"
      />
    </FlexElement>
  );
};

export const arrayEnumFieldRenderer: SchemaFieldRenderer = {
  match: schema => schema.type === "array" && !!schema.items?.enum,
  Component: ArrayEnumField
};
