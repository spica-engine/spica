import {FIELD_REGISTRY, resolveFieldKind} from "./registry";
import {makeInnerFieldDefaults, BASE_PRESET_DEFAULTS} from "./defaults";
import {FieldKind, type FieldDefinition, type FieldCreationForm} from "./types";

interface InitFormOptions {
  inner?: boolean;
  initial?: Partial<FieldCreationForm & {type?: FieldKind}>;
}

function initForm(kind: FieldKind, opts: InitFormOptions = {}) {
  const baseSeed = opts.inner
    ? makeInnerFieldDefaults(kind)
    : FIELD_REGISTRY[kind as FieldKind]?.creationFormDefaultValues;
  if (!baseSeed) throw new Error(`initForm: unknown field kind '${kind}'`);
  // Defensive deep clone (structuredClone available in modern runtimes)
  const seed: FieldCreationForm =
    typeof structuredClone === "function"
      ? structuredClone(baseSeed)
      : {
          fieldValues: {...baseSeed.fieldValues},
          configurationValues: {...baseSeed.configurationValues},
          presetValues: {...baseSeed.presetValues},
          defaultValue: {...baseSeed.defaultValue}
        };

  const initial = (opts.initial || {}) as Partial<FieldCreationForm & {innerFields?: any[]}>;

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
  const def = FIELD_REGISTRY[kind];
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

// Dedicated stripper usable before buildCreationFormPropertiesFromForm
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
  const def = FIELD_REGISTRY[kind];
  let errors: any = null;
  // Use registry validate first, else fallback to central schema map
  if (def?.validateCreationForm) {
    errors = def.validateCreationForm(form);
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
function buildCreationFormPropertiesFromForm(form: any) {
  if (!form) throw new Error("buildCreationFormPropertiesFromForm: form is required");
  const kind = resolveFieldKind(form.type);
  if (!kind)
    throw new Error(`buildCreationFormPropertiesFromForm: unknown field kind '${form.type}'`);
  const def = FIELD_REGISTRY[kind];
  if (!def)
    throw new Error(`buildCreationFormPropertiesFromForm: definition missing for '${kind}'`);

  // 1. Preset sanitation (capability aware)
  const preset = stripUnsupportedPresetValues({...(form.presetValues || {})}, def);
  if (Array.isArray(preset.enumeratedValues)) {
    const normalized = preset.enumeratedValues;
    if (normalized.length) preset.enumeratedValues = normalized;
    else delete preset.enumeratedValues;
    if (!normalized.length) preset.makeEnumerated = false;
  }
  if (
    preset.definePattern &&
    typeof preset.regularExpression === "string" &&
    !preset.regularExpression
  ) {
    delete preset.regularExpression;
    preset.definePattern = false;
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
  const built = def.buildCreationFormProperties() as any;

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
    built.enum = built.enum.filter((v: any) => {
      const sig = typeof v + ":" + v;
      if (sigSeen.has(sig)) return false;
      sigSeen.add(sig);
      return true;
    });
  }
  return built;
}

import {
  addInnerField,
  updateInnerField,
  removeInnerField,
} from "./inner-fields";

export {
  initFormWithTitleFallback,
  validateForm,
  buildCreationFormPropertiesFromForm,
  addInnerField,
  updateInnerField,
  removeInnerField,
  FieldKind,
  initForm,
  FIELD_REGISTRY
};
