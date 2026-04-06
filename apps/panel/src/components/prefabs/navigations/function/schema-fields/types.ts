import type {FC} from "react";

export type SchemaFieldStyles = Record<string, string>;

export type SchemaFieldProps = {
  fieldKey: string;
  label: string;
  schema: Record<string, any>;
  value: any;
  onChange: (val: any) => void;
};

export type SchemaFieldRenderer = {
  match: (schema: Record<string, any>) => boolean;
  Component: FC<SchemaFieldProps>;
};

export type RenderFieldFn = (
  key: string,
  schema: Record<string, any>,
  value: any,
  onChange: (val: any) => void,
  prefix?: string
) => React.ReactNode;

export type ArrayCallbacks = {
  onArrayItemAdd: (key: string) => void;
  onArrayItemRemove: (key: string, index: number) => void;
  onArrayItemChange: (key: string, index: number, field: string, value: any) => void;
  onNestedChange: (parentKey: string, childKey: string, value: any) => void;
};
