import {BooleanInput} from "oziko-ui-kit";
import type {SchemaFieldProps, SchemaFieldRenderer} from "./types";

const BooleanField = ({fieldKey, label, value, onChange}: SchemaFieldProps) => {
  return (
    <BooleanInput
      key={fieldKey}
      label={label}
      checked={value ?? false}
      onChange={onChange}
    />
  );
};

export const booleanFieldRenderer: SchemaFieldRenderer = {
  match: schema => schema.type === "boolean",
  Component: BooleanField
};
