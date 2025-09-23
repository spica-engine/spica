import type {ReactNode} from "react";
import type { FieldKind } from "src/domain/fields";
import type {TypeArrayItems} from "src/hooks/useInputRepresenter";
import type {Properties} from "src/services/bucketService";

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
  type?: FieldKind;
  deletable?: boolean;
  title?: string;
  pattern?: string;
  minimum?: number;
  maximum?: number;
  items?: TypeArrayItems;
  minItems?: number;
  maxItems?: number;
  properties?: Properties;
  required?: string[];
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
  type?: FieldKind;
  required?: boolean;
  requiredFields?: string[];
};
