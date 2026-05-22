import {NumberInput} from "oziko-ui-kit";
import type {SchemaFieldProps, SchemaFieldRenderer} from "./types";

const NumberField = ({fieldKey, label, value, onChange}: SchemaFieldProps) => {
  return (
    <NumberInput
      key={fieldKey}
      label={label}
      value={value ?? undefined}
      onChange={onChange}
    />
  );
};

export const numberFieldRenderer: SchemaFieldRenderer = {
  match: schema => schema.type === "integer" || schema.type === "number",
  Component: NumberField
};
