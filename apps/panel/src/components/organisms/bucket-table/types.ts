

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
  | "color";

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

export interface BucketSchema {
  _id: string;
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
  _id: string;
  [key: string]: any;
}

export interface CellRendererProps {
  value: any;
  onChange: (newValue: any) => void;
  property: BucketProperty;
  propertyKey: string;
  rowId: string;
  isFocused: boolean;
  onRequestBlur: () => void;
}

export interface CellKeyboardHandler {
  handleKeyDown: (event: KeyboardEvent, context: CellKeyboardContext) => boolean | void;
}

export interface CellKeyboardContext {
  value: any;
  onChange: (newValue: any) => void;
  property: BucketProperty;
  propertyKey: string;
  rowId: string;
  onRequestBlur: () => void;
}

export interface CellTypeConfig {
  component: React.ComponentType<CellRendererProps>;
  keyboardHandler: CellKeyboardHandler;
  defaultValue?: any;
}

