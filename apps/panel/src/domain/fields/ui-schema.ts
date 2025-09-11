/**
 * UI Schema Builders
 * ------------------------------------------------------------
 * Generates grouped form schemas: { main, configuration, defaults }.
 * Logic intentionally declarative; avoid embedding business rules here.
 */
import {FieldKind, type FieldDefinition} from "./types";
import {getFieldDefinition} from "./registry";

// ---------------------------------------------------------------------------
// Configuration Input Definitions
// ---------------------------------------------------------------------------
const CFG_PRIMARY = {type: "boolean", title: "Primary Field", size: "small"};
const CFG_TRANSLATE = {type: "boolean", title: "Translatable", size: "small"};
const CFG_UNIQUE = {type: "boolean", title: "Unique Values", size: "small"};
const CFG_REQUIRED = {type: "boolean", title: "Required Field", size: "small"};
const CFG_INDEX = {type: "boolean", title: "Indexed field in database", size: "small"};

export function getConfigurationInputs(kind: FieldKind, inner = false): Record<string, any> {
  const def: FieldDefinition | undefined = getFieldDefinition(kind as FieldKind);
  const caps = def?.capabilities || {};
  // Inner field simplified rule set
  if (inner) {
    const out: Record<string, any> = {};
    if (caps.indexable) out.index = CFG_INDEX;
    out.requiredField = CFG_REQUIRED; // Always allow required toggle for inner unless business rules change
    return out;
  }
  const out: Record<string, any> = {};
  if (caps.primaryEligible) out.primaryField = CFG_PRIMARY;
  if (caps.uniqueEligible) out.uniqueValues = CFG_UNIQUE;
  if (caps.translatable) out.translate = CFG_TRANSLATE;
  // Required/index toggles: show when logically meaningful
  out.requiredField = CFG_REQUIRED;
  if (caps.indexable) out.index = CFG_INDEX;
  return out;
}

// ---------------------------------------------------------------------------
// Main Form Input Definitions
// ---------------------------------------------------------------------------
export function getMainFormInputs(kind: FieldKind): Record<string, any> {
  const base: Record<string, any> = {
    title: {type: "string", title: "Name", required: true},
    description: {type: "textarea", title: "Description"}
  };
  if (kind === FieldKind.Number) {
    base.minimum = {type: "number", title: "Minimum"};
    base.maximum = {type: "number", title: "Maximum"};
    base.makeEnumerated = {type: "boolean", title: "Make field enumerated", size: "small"};
    base.enumeratedValues = {
      type: "chip",
      title: "EnumeratedValues",
      valueType: "number",
      renderCondition: {field: "makeEnumerated", equals: true}
    };
  } else if (kind === FieldKind.Array) {
    base.arrayType = {
      type: "string",
      title: "Array Type",
      enum: [
        "string",
        "date",
        "number",
        "textarea",
        "boolean",
        "color",
        "storage",
        "multiselect",
        "location",
        "richtext",
        "object",
        "json"
      ],
      required: true
    };
    base.arrayItemTitle = {type: "string", title: "Title"};
    base.arrayItemDescription = {type: "string", title: "Description"};
    base.defaultString = {
      type: "string",
      title: "Default Value",
      renderCondition: {field: "arrayType", equals: "string"}
    };
    base.defaultBoolean = {
      type: "boolean",
      title: "Default value",
      size: "small",
      renderCondition: {field: "arrayType", equals: "boolean"}
    };
    base.defaultNumber = {
      type: "number",
      title: "Default Value",
      renderCondition: {field: "arrayType", equals: "number"}
    };
    base.minNumber = {
      type: "number",
      title: "Minimum",
      renderCondition: {field: "arrayType", equals: "number"}
    };
    base.maxNumber = {
      type: "number",
      title: "Maximum",
      renderCondition: {field: "arrayType", equals: "number"}
    };
    base.makeEnumerated = {
      type: "boolean",
      title: "Make field enumerated",
      size: "small",
      renderCondition: {field: "arrayType", equals: "number"}
    };
    base.enumeratedValues = {
      type: "chip",
      title: "EnumeratedValues",
      valueType: "number",
      renderCondition: {field: "makeEnumerated", equals: true}
    };
    base.regularExpression = {
      type: "string",
      title: "Regex",
      renderCondition: {field: "definePattern", equals: true}
    };
    base.uniqueItems = {
      type: "boolean",
      title: "Items should be unique",
      size: "small",
      renderCondition: {
        field: "arrayType",
        notEquals: ["multiselect", "location", "object", "boolean"]
      }
    };
    base.multipleSelectionType = {
      type: "string",
      title: "Type",
      enum: ["string", "number"],
      required: true,
      renderCondition: {field: "arrayType", equals: "multiselect"}
    };
    base.minItems = {
      type: "number",
      title: "Min Items",
      renderCondition: {field: "arrayType", notEquals: ["multiselect", "location", "object"]}
    };
    base.maxItems = {
      type: "number",
      title: "Max Items",
      renderCondition: {field: "arrayType", notEquals: ["location", "object"]}
    };
    base.chip = {
      type: "chip",
      title: "",
      renderCondition: {field: "arrayType", equals: "multiselect"}
    };
  } else if (kind === FieldKind.Multiselect) {
    base.multipleSelectionType = {
      type: "string",
      title: "Type",
      enum: ["string", "number"],
      required: true
    };
    base.maxItems = {type: "number", title: "Max Items"};
    base.chip = {type: "chip", title: ""};
  } else if (kind === FieldKind.Relation) {
    base.bucket = {title: "Buckets", type: "select", enum: [], required: true};
    base.relationType = {
      title: "Relation Type",
      type: "select",
      enum: [
        {label: "One To One", value: "onetoone"},
        {label: "One To Many", value: "onetomany"}
      ],
      required: true
    };
    base.dependent = {type: "boolean", title: "Dependent", size: "small"};
  }
  if (kind === FieldKind.String) {
    base.preset = {
      type: "string",
      title: "Presets",
      enum: ["Countries", "Days", "Email", "Phone Number"]
    };
    base.makeEnumerated = {type: "boolean", title: "Make field enumerated", size: "small"};
    base.enumeratedValues = {
      type: "chip",
      title: "EnumeratedValues",
      renderCondition: {field: "makeEnumerated", equals: true}
    };
    base.definePattern = {type: "boolean", title: "Define Pattern", size: "small"};
    base.regularExpression = {
      type: "string",
      title: "Regex",
      renderCondition: {field: "definePattern", equals: true}
    };
  }
  return base;
}

// ---------------------------------------------------------------------------
// Aggregator
// ---------------------------------------------------------------------------
export function buildUiSchema(
  kind: FieldKind,
  opts: {inner?: boolean; buckets?: Array<{_id: string; title: string}>} = {}
) {
  const main = getMainFormInputs(kind) || {};
  // Dynamic relation bucket enumeration injection (Step 5)
  if (kind === FieldKind.Relation && opts.buckets) {
    if (main.bucket) {
      main.bucket = {
        ...main.bucket,
        enum: opts.buckets.map(b => ({label: b.title, value: b._id}))
      };
    }
  }
  const configuration = getConfigurationInputs(kind, !!opts.inner) || {};
  const def = getFieldDefinition(kind);
  const defaults: Record<string, any> = buildDefaultValueInputsFromMeta(def);
  return {main, configuration, defaults};
}

// ---------------------------------------------------------------------------
// Unified UI Config Accessor
// getFieldUIConfig(kind) -> { main, configuration, defaults }
// Adds dynamic default-value input mapping derived from definition seeds.

function buildDefaultValueInputsFromMeta(def?: FieldDefinition): Record<string, any> {
  if (!def || !def.capabilities?.hasDefaultValue) return {};
  if (!def.meta?.defaultInputs || !def.meta.defaultInputs.length) {
    // Intentionally do not infer anymore; metadata mandatory for defaults.
    return {};
  }
  const map: Record<string, any> = {};
  for (const spec of def.meta.defaultInputs) {
    if (!spec.key) continue;
    if (spec.type === "macro") {
      map[spec.key] = {
        type: "string",
        title: spec.title || "Default",
        enum: (spec.macros || []).map(v => {
          if (v === "") return {label: "None", value: v};
          if (v === ":created_at") return {label: "Created At", value: v};
          if (v === ":updated_at") return {label: "Updated At", value: v};
          return {label: v, value: v};
        })
      };
      continue;
    }
    map[spec.key] = {
      type: spec.type,
      title: spec.title || "Default Value",
      enum: spec.enum,
      valueType: spec.valueType
    };
  }
  return map;
}

export function getFieldUIConfig(
  kind: FieldKind,
  ctx: {inner?: boolean; buckets?: Array<{_id: string; title: string}>} = {}
) {
  return buildUiSchema(kind, ctx);
}
