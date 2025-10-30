export interface FieldConfig {
  _id?: string;
  name: string;
  title?: string;
  description?: string;
  type: string;
  primary?: boolean;
  unique?: boolean;
  required?: boolean;
  indexed?: boolean;
  translatable?: boolean;
  default?: any;
  // Number specific
  minimum?: number;
  maximum?: number;
  enumerated?: boolean;
  enumeratedValues?: number[];
  // Select specific
  presets?: string[];
  multiple?: boolean;
  maxItems?: number;
  selectType?: string;
  pattern?: string;
  // Date specific
  defaultDate?: string;
  [key: string]: any;
}

export interface EditorProps {
  value: FieldConfig;
  onChange: (value: FieldConfig) => void;
}

export interface FieldTypeRule {
  canBePrimary?: boolean;
  canBeUnique?: boolean;
  canBeRequired?: boolean;
  canBeIndexed?: boolean;
  canBeTranslatable?: boolean;
  hasDefaultValue?: boolean;
  hasMinMax?: boolean;
  hasEnumeration?: boolean;
  hasPresets?: boolean;
  hasMultipleSelection?: boolean;
  hasDefaultDate?: boolean;
}

export interface HandlerRequest {
  type: string;
  rules: FieldTypeRule;
  Editor: React.ComponentType<EditorProps>;
}

export const FIELD_TYPES = [
  {value: "string", label: "String", icon: "text-width"},
  {value: "number", label: "Number", icon: "hashtag"},
  {value: "date", label: "Date", icon: "calendar"},
  {value: "boolean", label: "Boolean", icon: "check-square"},
  {value: "textarea", label: "Textarea", icon: "align-left"},
  {value: "select", label: "Select", icon: "list"},
  {value: "relation", label: "Relation", icon: "link"},
  {value: "location", label: "Location", icon: "map-marker"},
  {value: "array", label: "Array", icon: "list-ol"},
  {value: "object", label: "Object", icon: "cube"},
  {value: "file", label: "File", icon: "file"},
  {value: "richtext", label: "Richtext", icon: "font"},
  {value: "color", label: "Color", icon: "palette"},
  {value: "json", label: "JSON", icon: "code"}
];

