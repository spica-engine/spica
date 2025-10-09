import type {IconName} from "oziko-ui-kit";
import type {BucketType, Property} from "../../store/api/bucketApi";
import type {TypeInputRepresenterError, TypeProperties} from "oziko-ui-kit/dist/custom-hooks/useInputRepresenter";

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
  multipleSelectionTab?: Record<string, any>;
  type: FieldKind;
}

export interface FieldCapabilities {
  enumerable?: boolean;
  pattern?: boolean;
  numericConstraints?: boolean;
  supportsInnerFields?: boolean;
  hasDefaultValue?: boolean;
  translatable?: boolean;
  primaryEligible?: boolean;
  uniqueEligible?: boolean;
  indexable?: boolean;
}

export interface InnerFieldFormState extends FieldFormState {
  id: string;
}

export interface FieldFormState extends FieldCreationForm {
  type: FieldKind;
  innerFields?: InnerFieldFormState[];
  id?: string;
}

export interface FieldCreationFormProperties {
  fieldValues: TypeProperties;
  defaultValue?: TypeProperties[keyof TypeProperties];
  configurationValues: TypeProperties;
  presetValues?: TypeProperties;
  multipleSelectionTab?: TypeProperties;
}

export interface FieldDefinition {
  kind: FieldKind; // name of the field kind
  display: FieldDisplayMeta; // UI metadata
  creationFormDefaultValues: FieldCreationForm; // seed values for creation form
  getDefaultValue?: (property: Property) => any; // default value for data creation using this field, if any
  validateCreationForm: (form: FieldFormState) => TypeInputRepresenterError | null; // validate the creation form state for this field type
  validateValue: (value: any, properties: Property) => string | null; // validate a raw value for this field (e.g. before saving data)
  buildCreationFormProperties: (
    isInnerField: boolean,
    buckets?: BucketType[]
  ) => FieldCreationFormProperties;
  buildValueProperty: (property: Property) => TypeProperties[keyof TypeProperties]; // build TypeProperty-compatible value schema for this field
  requiresInnerFields?: (form: FieldCreationForm) => boolean; // whether this field kind structurally requires at least one inner field
  applyPresetLogic?: (form: FieldCreationForm, oldValues: FieldCreationForm) => FieldCreationForm; // apply preset logic to the form state, (only for string and array's with string items)
  applySelectionTypeLogic?: (
    form: FieldCreationForm,
    properties: TypeProperties
  ) => {updatedForm: FieldCreationForm; updatedFieldProperties: TypeProperties}; // apply selection type logic to the form state (only for multiselect)
  // Optional formatting function for displaying values in lists, etc.
  getFormattedValue?: (value: any) => any;
  // Optional builder that converts a FieldFormState to API Property definition (progressive migration from createFieldProperty.ts)
  buildCreationFormApiProperty: (form: FieldFormState) => Property;
  capabilities?: FieldCapabilities;
}
