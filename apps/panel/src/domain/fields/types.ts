import type {IconName} from "oziko-ui-kit";
import type {Property} from "../../services/bucketService";
import type {
  TypeInputRepresenterError,
  TypeProperties
} from "oziko-ui-kit/dist/custom-hooks/useInputRepresenter";
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

export type RelationInputRelationHandlers = {
  getOptions: getOptionsHandler;
  loadMoreOptions: loadMoreOptionsHandler;
  searchOptions: searchOptionsHandler;
  relationState: RelationState;
  totalOptionsLength?: number;
};

export type ObjectInputRelationHandlers = {
  getOptionsMap: TypeGetOptionsMap;
  loadMoreOptionsMap: TypeGetMoreOptionsMap;
  searchOptionsMap: TypeSearchOptionsMap;
  relationStates: Record<string, RelationState>;
  totalOptionsLength?: number;
};

export interface FieldDefinition {
  kind: FieldKind;  
  display: FieldDisplayMeta; 
  creationFormDefaultValues: FieldCreationForm; 
  getDefaultValue: (property: Property) => any; 
  validateCreationForm: (form: FieldCreationForm) => TypeInputRepresenterError | null; 
  validateValue: (value: any, properties: Property, required?: boolean) => FormError; 
  buildCreationFormProperties: (isInnerField?: boolean) => {
    fieldValues: TypeProperties;
    configurationValues: TypeProperties;
    presetValues?: TypeProperties;
    defaultValue?: TypeProperty;
  };
  buildValueProperty: (
    property: Property,
    relationProps?: RelationInputRelationHandlers | ObjectInputRelationHandlers
  ) => TypeProperty; 
  requiresInnerFields?: (form: FieldCreationForm) => boolean; 
  applyPresetLogic?: (form: FieldCreationForm, oldValues: FieldCreationForm) => FieldCreationForm; 
  applySelectionTypeLogic?: (
    form: FieldCreationForm,
    properties: TypeProperties
  ) => {updatedForm: FieldCreationForm; updatedFieldProperties: TypeProperties}; 
  getDisplayValue: (value: any, properties?: Property) => any;
  getSaveReadyValue: (value: any, properties?: Property) => any; 
  buildCreationFormApiProperty: (form: FieldFormState) => Property;
  capabilities?: FieldCapabilities;
}

export type FieldRegistry = Partial<Record<FieldKind, FieldDefinition>>;
