import {FIELD_REGISTRY} from "./registry";
import {BASE_PRESET_DEFAULTS} from "./defaults";
import {FieldKind, type FieldDefinition, type FieldFormState} from "./types";

function initForm(kind: FieldKind, initialValues?: FieldFormState) {
  const seed = FIELD_REGISTRY[kind as FieldKind]?.creationFormDefaultValues;
  if (!seed) throw new Error(`initForm: unknown field kind '${kind}'`);
  const initial = initialValues || ({} as FieldFormState);
  // Capability-based sanitization (enumeration / pattern fields removed when unsupported)
  const def = FIELD_REGISTRY[kind];
  return sanitizeFormByCapabilities(initial, def);
}

// Remove preset keys that definition does not support; reset to BASE_PRESET_DEFAULTS subset for stability.
function sanitizeFormByCapabilities(form: FieldFormState, def?: FieldDefinition) {
  if (!def) return form;
  const caps = def.capabilities || {};
  if (!caps.enumerable) {
    delete form.presetValues.enumeratedValues;
    delete form.presetValues.makeEnumerated;
  }
  if (!caps.pattern) {
    delete form.presetValues.definePattern;
    delete form.presetValues.pattern;
  }
  // Rehydrate missing base keys to avoid undefined access in UI layers
  form.presetValues = {
    ...BASE_PRESET_DEFAULTS,
    ...form.presetValues
  };
  return form;
}

export {initForm, FieldKind, FIELD_REGISTRY};
