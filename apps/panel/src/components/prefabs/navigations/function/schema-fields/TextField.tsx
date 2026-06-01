import {StringInput} from "oziko-ui-kit";
import type {SchemaFieldProps, SchemaFieldRenderer} from "./types";

const TextField = ({fieldKey, label, schema, value, onChange}: SchemaFieldProps) => {
  return (
    <StringInput
      key={fieldKey}
      label={label}
      value={value ?? ""}
      onChange={onChange}
    />
  );
};

export const textFieldRenderer: SchemaFieldRenderer = {
  match: () => true,
  Component: TextField
};
