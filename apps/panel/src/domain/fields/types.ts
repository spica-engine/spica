import type {IconName} from "oziko-ui-kit";
import type {Property, BucketType} from "../../services/bucketService";
import type {
  TypeProperties,
  TypeInputRepresenterError
} from "oziko-ui-kit/dist/custom-hooks/useInputRepresenter";
import type {RefObject} from "react";
import type {
  getOptionsHandler,
  loadMoreOptionsHandler,
  RelationState,
  searchOptionsHandler,
  TypeGetMoreOptionsMap,
  TypeGetOptionsMap,
  TypeSearchOptionsMap
} from "src/hooks/useRelationInputHandlers";

export type TypeProperty = TypeProperties[string];

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

export type FormError =
  | string
  | null
  | {
      [key: string]: string | FormError | null;
    };

type RelationInputRelationHandlers = {
  getOptions: getOptionsHandler;
  loadMoreOptions: loadMoreOptionsHandler;
  searchOptions: searchOptionsHandler;
  relationState: RelationState;
};

export type ObjectInputRelationHandlers = {
  getOptionsMap: TypeGetOptionsMap;
  loadMoreOptionsMap: TypeGetMoreOptionsMap;
  searchOptionsMap: TypeSearchOptionsMap;
  relationStates: Record<string, RelationState>;
};

export interface FieldDefinition {
  kind: FieldKind; // name of the field kind
  display: FieldDisplayMeta; // UI metadata
  creationFormDefaultValues: FieldCreationForm; // seed values for creation form
  getDefaultValue?: (property: Property) => any; // default value for data creation using this field, if any
  validateCreationForm: (form: FieldCreationForm) => TypeInputRepresenterError | null; // validate the creation form state for this field type
  validateValue: (value: any, properties: Property, required?: boolean) => FormError; // validate a raw value for this field (e.g. before saving data)
  buildCreationFormProperties: (
    isInnerField: boolean,
    buckets?: BucketType[]
  ) => FieldCreationFormProperties;
  buildValueProperty: (
    property: Property,
    relationProps?: RelationInputRelationHandlers | ObjectInputRelationHandlers
  ) => TypeProperty; // build TypeProperty-compatible value schema for this field
  requiresInnerFields?: (form: FieldCreationForm) => boolean; // whether this field kind structurally requires at least one inner field
  applyPresetLogic?: (form: FieldCreationForm, oldValues: FieldCreationForm) => FieldCreationForm; // apply preset logic to the form state, (only for string and array's with string items)
  applySelectionTypeLogic?: (
    form: FieldCreationForm,
    properties: TypeProperties
  ) => {updatedForm: FieldCreationForm; updatedFieldProperties: TypeProperties}; // apply selection type logic to the form state (only for multiselect)
  // Optional formatting function for displaying values in lists, etc.
  getDisplayValue: (value: any, properties?: Property) => any;
  getSaveReadyValue: (value: any, properties?: Property) => any; // transform the value into a save-ready format, if needed (e.g. for uploading to server)
  capabilities?: FieldCapabilities;
  renderValue: (value: any, deletable: boolean, className?: string) => React.ReactNode; // custom render function for displaying values
  renderInput: React.FC<{
    value: any;
    onChange: (value: any) => void;
    ref: RefObject<HTMLElement | HTMLTextAreaElement | null>;
    properties: Property;
    title?: string;
    floatingElementRef?: RefObject<HTMLInputElement | HTMLDivElement | null>; // ref for dropdowns/popovers inside the input component
    className?: string;
    error?: FormError;
    onClose?: () => void;
  }>; // custom input renderer for quick editing in tables, etc.
  buildCreationFormApiProperty: (form: FieldFormState) => Property;
}
