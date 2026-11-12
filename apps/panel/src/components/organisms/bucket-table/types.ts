
import type { SystemRecord } from "../../../utils/recordKey";

export type BucketPropertyType = 
  | "string" 
  | "textarea" 
  | "number" 
  | "date" 
  | "relation"
  | "boolean"
  | "array"
  | "multiselect"
  | "object"
  | "color"
  | "uuid"
  | "integer"
  | "bigint";

export interface BucketProperty {
  type: BucketPropertyType;
  title: string;
  description?: string;
  options?: {
    position?: string;
    translate?: boolean;
    [key: string]: any;
  };
  relationType?: string;
  bucketId?: string;
  dependent?: boolean;
  [key: string]: any;
}

export interface BucketSchema extends SystemRecord {
  title: string;
  description?: string;
  icon?: string;
  primary?: string;
  readOnly?: boolean;
  history?: boolean;
  properties: Record<string, BucketProperty>;
  acl?: {
    write?: string;
    read?: string;
  };
  order?: number;
  indexes?: any[];
}

export interface BucketDataRow {
  [key: string]: any;
}

export interface CellRendererProps {
  value: any;
  onChange: (newValue: any) => void;
  property: BucketProperty;
  propertyKey: string;
  rowId: string;
}

export interface CellTypeConfig {
  component: React.ComponentType<CellRendererProps>;
  defaultValue?: any;
}

