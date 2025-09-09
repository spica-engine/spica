import type {ReactNode} from "react";
import type {TypeArrayItems} from "src/hooks/useInputRepresenter";
import type {Properties} from "src/services/bucketService";

export type FieldType =
  | "string"
  | "number"
  | "date"
  | "boolean"
  | "textarea"
  | "multiple selection"
  | "relation"
  | "location"
  | "array"
  | "object"
  | "file"
  | "richtext"
  | "multiselect"
  | "color";

export type TypeDataColumn = {
  header: string | ReactNode;
  key: string;
  id: string;
  width?: string;
  headerClassName?: string;
  cellClassName?: string;
  resizable?: boolean;
  fixed?: boolean;
  selectable?: boolean;
  leftOffset?: number;
  type?: FieldType;
  deletable?: boolean;
  title?: string;
  pattern?: string;
  minimum?: number;
  maximum?: number;
  items?: TypeArrayItems;
  minItems?: number;
  maxItems?: number;
  properties?: Properties;
};

export type TypeTableData = {
  [k: string]: {
    id: string;
    value: any;
  };
};

export type Constraints = {
  pattern?: string;
  minimum?: number;
  maximum?: number;
  minItems?: number;
  maxItems?: number;
  items?: TypeArrayItems;
  properties?: Properties;
};
