import type {IconName} from "oziko-ui-kit";
import type {Property} from "../../services/bucketService";
import type {
  TypeProperties,
} from "oziko-ui-kit/build/dist/custom-hooks/useInputRepresenter";

type TypeProperty = TypeProperties[string];

export enum FieldKind {
  String = "string",
  Number = "number",
  Date = "date",
  Boolean = "boolean",
  Textarea = "textarea",
  Multiselect = "multiselect",
  Relation = "relation",
  Location = "location",
  Array = "array",
  Object = "object",
  File = "storage",
  Richtext = "richtext",
  Json = "json",
  Color = "color"
}

export interface FieldDisplayMeta {
  label: string;
  icon: IconName;
}

export interface FieldCreationForm {
  fieldValues: Record<string, any>;
  configurationValues: Record<string, any>;
  presetValues: Record<string, any>;
  defaultValue?: any;
}

export interface FieldCapabilities {
  enumerable?: boolean;
  pattern?: boolean;
  numericConstraints?: boolean;
  supportsInnerFields?: boolean;
  hasDefaultValue?: boolean;
  // New extended capability flags (metadata driven configuration)
  translatable?: boolean; // Field supports translation toggle
  primaryEligible?: boolean; // Field can become a "primary" field
  uniqueEligible?: boolean; // Field can enable unique constraint
  indexable?: boolean; // Field can be indexed
}

export interface FieldFormState extends FieldCreationForm {
  type: FieldKind;
  innerFields?: any[]; // for object/array-of-object editing flows
}

export interface FieldDefinition {
  kind: FieldKind; // name of the field kind
  display: FieldDisplayMeta; // UI metadata
  creationFormDefaultValues: FieldCreationForm; // seed values for creation form
  getDefaultValue: (property: Property) => any; // default value for data creation using this field, if any
  validateCreationForm: (form: FieldCreationForm) => Record<string, string> | null; // validate the creation form state for this field type
  validateValue: (value: any, properties: any) => string | null; // validate a raw value for this field (e.g. before saving data)
  buildCreationFormProperties: () => {
    fieldValues: TypeProperties;
    configurationValues: TypeProperties;
    presetValues?: TypeProperties;
    defaultValue?: TypeProperty;
  };
  buildValueProperty: (
    property: Property,
    relationProps?: {
      getOptions?: () => Promise<{label: string; value: string}[]>;
      loadMoreOptions?: () => Promise<{label: string; value: string}[]>;
      searchOptions?: (search: string) => Promise<{label: string; value: string}[]>;
      totalOptionsLength?: number;
    }
  ) => TypeProperty; // build TypeProperty-compatible value schema for this field
  requiresInnerFields?: (form: FieldCreationForm) => boolean; // whether this field kind structurally requires at least one inner field
  applyPresetLogic?: (form: FieldCreationForm, oldValues: FieldCreationForm) => FieldCreationForm; // apply preset logic to the form state, (only for string and array's with string items)
  // Optional formatting function for displaying values in lists, etc.
  getFormattedValue?: (value: any) => any;
  capabilities?: FieldCapabilities;
}
