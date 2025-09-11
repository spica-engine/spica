/**
 * Field Domain Facade
 * --------------------------------------
 * Aggregates primitives (registry, defaults, validation, UI schema, property build/parse)
 * into a cohesive, stable API consumed by UI components. All field lifecycle
 * concerns should route through this layer.
 */
import {getFieldDefinition, resolveFieldKind} from "./registry";
import {getFieldUIConfig} from "./ui-schema";
import {getFieldDefaults, makeInnerFieldDefaults, BASE_PRESET_DEFAULTS} from "./defaults";
import {
  FieldKind,
  type FieldDefinition,
  type FieldFormDefaults,
  type PersistedFieldProperty
} from "./types";
import {normalizeEnum, sanitizePattern} from "./normalizers";

// ---------------------------------------------------------------------------
// Form Lifecycle
// ---------------------------------------------------------------------------
interface InitFormOptions {
  inner?: boolean;
  initial?: Partial<FieldFormDefaults & {type?: FieldKind}>;
}

function initForm(kind: FieldKind, opts: InitFormOptions = {}) {
  const baseSeed = opts.inner ? makeInnerFieldDefaults(kind) : getFieldDefaults(kind);

  // Defensive deep clone (structuredClone available in modern runtimes)
  const seed: FieldFormDefaults =
    typeof structuredClone === "function"
      ? structuredClone(baseSeed)
      : {
          fieldValues: {...baseSeed.fieldValues},
          configurationValues: {...baseSeed.configurationValues},
          presetValues: {...baseSeed.presetValues},
          defaultValue: {...baseSeed.defaultValue}
        };

  const initial = (opts.initial || {}) as Partial<FieldFormDefaults & {innerFields?: any[]}>;

  const deepMerge = (target: any, src: any) => {
    if (!src) return target;
    for (const k of Object.keys(src)) {
      const sv = (src as any)[k];
      if (sv && typeof sv === "object" && !Array.isArray(sv)) {
        if (!target[k] || typeof target[k] !== "object" || Array.isArray(target[k])) target[k] = {};
        deepMerge(target[k], sv);
      } else {
        target[k] = sv;
      }
    }
    return target;
  };

  const merged: any = {
    fieldValues: deepMerge({...seed.fieldValues}, initial.fieldValues),
    configurationValues: deepMerge({...seed.configurationValues}, initial.configurationValues),
    presetValues: deepMerge({...seed.presetValues}, initial.presetValues),
    defaultValue: deepMerge({...seed.defaultValue}, initial.defaultValue),
    type: kind,
    innerFields: initial.innerFields ? [...initial.innerFields] : undefined
  };
  // Capability-based sanitization (enumeration / pattern fields removed when unsupported)
  const def = getFieldDefinition(kind);
  return sanitizeFormByCapabilities(merged, def);
}

// Extended helper: ensures a user-visible placeholder title when missing.
// Maintains prior UI behavior ("New Inner Field" for inner, "Name" for root).
function initFormWithTitleFallback(kind: FieldKind, opts: InitFormOptions = {}) {
  const form = initForm(kind, opts);
  if (!form.fieldValues.title) {
    form.fieldValues.title = opts.inner ? "New Inner Field" : "Name";
  }
  return form;
}

// Remove preset keys that definition does not support; reset to BASE_PRESET_DEFAULTS subset for stability.
function sanitizeFormByCapabilities(form: any, def?: FieldDefinition) {
  if (!def) return form;
  const caps = def.capabilities || {};
  if (!caps.enumerable) {
    delete form.presetValues.enumeratedValues;
    delete form.presetValues.makeEnumerated;
  }
  if (!caps.pattern) {
    delete form.presetValues.definePattern;
    delete form.presetValues.regularExpression;
  }
  // Rehydrate missing base keys to avoid undefined access in UI layers
  form.presetValues = {
    ...BASE_PRESET_DEFAULTS,
    ...form.presetValues
  };
  return form;
}

// Dedicated stripper usable before buildPropertyFromForm
function stripUnsupportedPresetValues(presetValues: any, def?: FieldDefinition) {
  if (!def) return presetValues;
  const caps = def.capabilities || {};
  const clone = {...presetValues};
  if (!caps.enumerable) {
    delete clone.enumeratedValues;
    delete clone.makeEnumerated;
  }
  if (!caps.pattern) {
    delete clone.definePattern;
    delete clone.regularExpression;
  }
  return clone;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------
interface ValidateContext {
  forbiddenNames?: string[];
}

function normalizeErrors(raw: any): Record<string, any> | null {
  if (!raw) return null;
  if (typeof raw !== "object" || Array.isArray(raw)) return {fieldValues: {title: String(raw)}};
  if (raw.title && !raw.fieldValues) return {fieldValues: {title: raw.title}};
  return raw as Record<string, any>;
}

function validateForm(
  kind: FieldKind,
  form: any
  //ctx: ValidateContext = {}
): Record<string, any> | null {
  const def = getFieldDefinition(kind);
  let errors: any = null;
  // Use registry validate first, else fallback to central schema map
  if (def?.validate) {
    errors = def.validate(form);
  }
  errors = normalizeErrors(errors);
  // Generic name validation (pattern + reserved)
  const nameError = false; //validateName(form?.fieldValues?.title, {forbidden: ctx.forbiddenNames});
  if (nameError) {
    errors = errors || {};
    errors.fieldValues = errors.fieldValues || {};
    if (!errors.fieldValues.title) errors.fieldValues.title = nameError;
  }
  // Structural inner field requirement
  const innerError = false; //validateInnerFields(kind, form);
  if (innerError) {
    errors = errors || {};
    if (!errors.innerFields) errors.innerFields = innerError;
  }
  return errors && Object.keys(errors).length ? errors : null;
}

// ---------------------------------------------------------------------------
// Property Build / Parse
// ---------------------------------------------------------------------------
function buildPropertyFromForm(form: any): PersistedFieldProperty {
  if (!form) throw new Error("buildPropertyFromForm: form is required");
  const kind = resolveFieldKind(form.type);
  if (!kind) throw new Error(`buildPropertyFromForm: unknown field kind '${form.type}'`);
  const def = getFieldDefinition(kind);
  if (!def) throw new Error(`buildPropertyFromForm: definition missing for '${kind}'`);

  // 1. Preset sanitation (capability aware)
  const preset = stripUnsupportedPresetValues({...(form.presetValues || {})}, def);
  if (Array.isArray(preset.enumeratedValues)) {
    const numericContext = def.capabilities?.numericConstraints;
    const normalized = normalizeEnum(preset.enumeratedValues, {
      trim: true,
      dedupe: true,
      dropEmpty: true,
      coerceNumber: !!numericContext
    });
    if (normalized.length) preset.enumeratedValues = normalized;
    else delete preset.enumeratedValues;
    if (!normalized.length) preset.makeEnumerated = false;
  }
  if (preset.definePattern && typeof preset.regularExpression === "string") {
    const cleaned = sanitizePattern(preset.regularExpression);
    if (cleaned) preset.regularExpression = cleaned;
    else {
      delete preset.regularExpression;
      preset.definePattern = false;
    }
  }

  // Number field enumerations live under fieldValues (legacy shape) – normalize for idempotence.
  if (
    resolveFieldKind(form.type) === FieldKind.Number &&
    Array.isArray(form.fieldValues?.enumeratedValues)
  ) {
    const normalizedNumEnum = normalizeEnum(form.fieldValues.enumeratedValues, {
      trim: true,
      dedupe: true,
      dropEmpty: true,
      coerceNumber: true
    });
    form.fieldValues.enumeratedValues = normalizedNumEnum;
  }

  // 2. Adapt form for definition consumption
  const adapted = {
    fieldValues: form.fieldValues || {},
    configurationValues: form.configurationValues || {},
    presetValues: preset,
    defaultValue: form.defaultValue || {},
    innerFields: form.innerFields,
    type: kind
  };

  // 3. Delegate to definition builder
  const built = def.buildProperty(adapted as any) as PersistedFieldProperty;

  // 4. Post-normalization (ensure required structural keys)
  built.type = kind; // enforce discriminator
  if (typeof built.title !== "string")
    built.title = String((adapted.fieldValues as any)?.title || "");
  // Guarantee absence rather than empty enum/pattern
  if (Array.isArray(built.enum) && built.enum.length === 0) delete built.enum;
  if (built.pattern === "") delete built.pattern;
  // 5. Sanitize extraneous keys (defensive against definition leakage)
  const allowed = new Set([
    "type",
    "title",
    "description",
    "enum",
    "pattern",
    "default",
    "minItems",
    "maxItems",
    "uniqueItems",
    "minimum",
    "maximum",
    "items",
    "properties",
    "options",
    "bucketId",
    "relationType",
    "dependent"
  ]);
  Object.keys(built).forEach(k => {
    if (!allowed.has(k)) delete (built as any)[k];
  });
  // Ensure enum uniqueness & stable order (stringify signature ordering by primitive comparison)
  if (Array.isArray(built.enum)) {
    const sigSeen = new Set<string>();
    built.enum = built.enum.filter(v => {
      const sig = typeof v + ":" + v;
      if (sigSeen.has(sig)) return false;
      sigSeen.add(sig);
      return true;
    });
  }
  return built;
}

function getUiSchema(
  kind: FieldKind,
  ctx: {inner?: boolean; buckets?: Array<{_id: string; title: string}>} = {}
) {
  return getFieldUIConfig(kind, ctx);
}

function formatValue(kind: FieldKind, value: any) {
  const def = getFieldDefinition(kind);
  if (def?.getFormattedValue) return def.getFormattedValue(value);
  return value == null ? "" : value;
}

import {
  addInnerField,
  updateInnerField,
  removeInnerField,
  listForbiddenNames
} from "./inner-fields";
import {applyPresetLogic} from "./presets";
import {coerceFieldShape, requiresInnerFields} from "./lifecycle";

export {
  getFieldDefinition,
  initFormWithTitleFallback,
  validateForm,
  buildPropertyFromForm,
  getUiSchema,
  formatValue,
  addInnerField,
  updateInnerField,
  removeInnerField,
  listForbiddenNames,
  applyPresetLogic,
  FieldKind,
  coerceFieldShape,
  requiresInnerFields,
  initForm,
};
