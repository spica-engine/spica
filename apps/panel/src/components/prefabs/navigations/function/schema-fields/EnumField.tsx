import {FlexElement, Select, Text} from "oziko-ui-kit";
import {useSchemaFieldContext} from "./SchemaFieldContext";
import type {SchemaFieldProps, SchemaFieldRenderer} from "./types";

const EnumField = ({fieldKey, label, schema, value, onChange}: SchemaFieldProps) => {
  const {styles} = useSchemaFieldContext();

  const viewEnum = schema.viewEnum as string[] | undefined;
  const selectOptions = (schema.enum as string[]).map((val: string, i: number) => ({
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
        value={value ?? ""}
        onChange={v => onChange(v as string)}
        dimensionX="fill"
      />
    </FlexElement>
  );
};

export const enumFieldRenderer: SchemaFieldRenderer = {
  match: schema => Array.isArray(schema.enum),
  Component: EnumField
};
