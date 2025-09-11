import type {IconName} from "oziko-ui-kit";
// NOTE: We intentionally avoid importing TypeProperty here for long-term decoupling of
// domain contracts from UI kit specifics. Existing definitions still return shapes
// compatible with useInputRepresenter; new unified types added below will be adopted
// incrementally (Phase 4 of refactor plan).

// ---------------------------------------------------------------------------
// Core Field Kinds
// ---------------------------------------------------------------------------

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

export interface FieldDisplayMeta { label: string; icon: IconName }

export interface FieldFormDefaults {
  fieldValues: Record<string, any>;
  configurationValues: Record<string, any>;
  presetValues: Record<string, any>;
  defaultValue: Record<string, any>;
}

// ---------------------------------------------------------------------------
// Refactor Phase 1: Unified Property / Form State Contracts (Introduced, not enforced yet)
// ---------------------------------------------------------------------------

// Capabilities extended beyond legacy flags. Additional flags will allow
// deriving configuration UI & default value inputs without large switches.
export interface FieldCapabilities {
  enumerable?: boolean;
  pattern?: boolean;
  numericConstraints?: boolean;
  supportsInnerFields?: boolean;
  hasDefaultValue?: boolean;
  // New extended capability flags (metadata driven configuration)
  translatable?: boolean;          // Field supports translation toggle
  primaryEligible?: boolean;       // Field can become a "primary" field
  uniqueEligible?: boolean;        // Field can enable unique constraint
  indexable?: boolean;             // Field can be indexed
  defaultMacros?: string[];        // Supported default macro tokens (e.g. :created_at)
}

// Canonical persisted property shape (progressively adopted). It mirrors what is
// currently produced by buildProperty functions but makes the contract explicit.
// Nested definitions (object / array) reference this same shape recursively.
export interface PersistedFieldProperty {
  type: FieldKind;                 // required discriminator
  title: string;                   // human label / identifier
  description?: string;
  // Generic constraints / scalar adornments
  enum?: (string | number)[];
  pattern?: string;
  default?: any;
  minimum?: number;
  maximum?: number;
  minItems?: number;
  maxItems?: number;
  uniqueItems?: boolean;
  // Nested structures
  properties?: Record<string, PersistedFieldProperty>; // object
  items?: PersistedFieldProperty | {                    // array / multiselect variant
    type: string;
    enum?: any[];
    items?: any;                                       // nested arrays (as-is for now)
    default?: any;
    pattern?: string;
  };
  // Relation / domain specific optional fields (kept loose intentionally for now)
  bucketId?: string;               // relation
  relationType?: string;           // relation cardinality
  dependent?: boolean;             // relation dependency behavior
  // Options bucket (UI / persistence hints)
  options?: Record<string, any>;
  // Additional future-proof extension point
  [k: string]: any;                // temporary escape hatch during migration
}

// Full form state used during editing (distinct from persisted property).
export interface FieldFormState extends FieldFormDefaults {
  type: FieldKind;
  innerFields?: PersistedFieldProperty[]; // for object/array-of-object editing flows
}

// Default value input metadata to eliminate inference heuristics later.
export interface DefaultInputSpec {
  key: string;                     // defaultValue object key
  type: string;                    // input type (string/number/boolean/select/macro/etc.)
  title?: string;                  // override label
  enum?: (string | number)[];      // enumerated default choices
  macros?: string[];               // macro tokens if applicable
  valueType?: string;              // chip value type, etc.
}

export interface FieldDefinition {
  kind: FieldKind;
  display: FieldDisplayMeta;
  readonly formDefaults: FieldFormDefaults; // seed values (cloned externally)
  buildProperty: (
    form: FieldFormDefaults & {fieldValues: {title?: string; description?: string}}
  ) => any; // Temporarily 'any' until all call sites migrated to PersistedFieldProperty
  parseProperty?: (property: any) => Partial<FieldFormDefaults & {type?: FieldKind}>;
  validate?: (
    form: FieldFormDefaults & {fieldValues: {title?: string; description?: string}}
  ) => Record<string, string> | null;
  // Optional future async validation (Phase 3 will wire facade support)
  validateAsync?: (
    form: FieldFormDefaults & {fieldValues: {title?: string; description?: string}},
    ctx?: Record<string, any>
  ) => Promise<Record<string, string> | null>;
  getFormattedValue?: (value: any) => any;
  capabilities?: FieldCapabilities;
  // Additional metadata for UI schema generation (avoids heuristic inference)
  meta?: {
    defaultInputs?: DefaultInputSpec[]; // explicit default value input configuration
  };
  // Formatting strategies (list view, export, detailed view) for future usage
  format?: {
    list?: (value: any) => string;
    export?: (value: any) => any;
    detail?: (value: any) => any;
  };
}

// Transitional re-export compatibility (alias) – retained for existing imports expecting the older name.
export type { FieldCapabilities as LegacyFieldCapabilities };
