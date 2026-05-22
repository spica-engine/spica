import {EnumInput} from "oziko-ui-kit";
import type {SchemaFieldProps, SchemaFieldRenderer} from "./types";

const EnumField = ({fieldKey, label, schema, value, onChange}: SchemaFieldProps) => {
  const viewEnum = schema.viewEnum as string[] | undefined;
  const options = (schema.enum as string[]).map((val: string, i: number) => ({
    label: viewEnum?.[i] ?? val,
    value: val
  }));

  return (
    <EnumInput
      key={fieldKey}
      label={label}
      options={options}
      value={value ?? ""}
      onChange={v => onChange(v as string)}
    />
  );
};

export const enumFieldRenderer: SchemaFieldRenderer = {
  match: schema => Array.isArray(schema.enum),
  Component: EnumField
};
