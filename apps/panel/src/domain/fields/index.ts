import {FIELD_REGISTRY} from "./registry";
import {BASE_PRESET_DEFAULTS} from "./defaults";
import {FieldKind, type FieldDefinition, type FieldFormState} from "./types";

function initForm(kind: FieldKind, initialValues?: FieldFormState) {
  const seed = {...FIELD_REGISTRY[kind as FieldKind]?.creationFormDefaultValues as FieldFormState};
  if (!seed) throw new Error(`initForm: unknown field kind '${kind}'`);
  const deepMerge = (target: any, src: any) => {
    if (!src || typeof src !== "object") return target;
    for (const k of Object.keys(src)) {
      const sv = src[k];
      if (sv && typeof sv === "object" && !Array.isArray(sv)) {
        if (!target[k] || typeof target[k] !== "object" || Array.isArray(target[k])) target[k] = {};
        deepMerge(target[k], sv);
      } else {
        target[k] = sv;
      }
    }
    return target;
  };
  const initial = initialValues as FieldFormState || ({} as FieldFormState);
  const merged = {} as FieldFormState;

  for (const key of Object.keys(seed)) {
    if (initial[key as keyof FieldFormState] === undefined) merged[key as keyof FieldFormState] = seed[key as keyof FieldFormState];
    else if (typeof seed[key as keyof FieldFormState] === "object" && seed[key as keyof FieldFormState] !== null) {
      merged[key as keyof FieldFormState] = deepMerge({...seed[key as keyof FieldFormState]}, initial[key as keyof FieldFormState]);
    }
  }

  return merged
}

// Remove preset keys that definition does not support; reset to BASE_PRESET_DEFAULTS subset for stability.
function sanitizeFormByCapabilities(form: FieldFormState, def?: FieldDefinition) {
  if (!def) return form;
  const caps = def.capabilities || {};
  if (!caps.enumerable) {
    if (form?.presetValues?.enumeratedValues) delete form.presetValues.enumeratedValues;
    if (form?.presetValues?.makeEnumerated) delete form.presetValues.makeEnumerated;
  }
  if (!caps.pattern) {
    if (form?.presetValues?.definePattern) delete form.presetValues.definePattern;
    if (form?.presetValues?.pattern) delete form.presetValues.pattern;
  }
  // Rehydrate missing base keys to avoid undefined access in UI layers
  form.presetValues = {
    ...BASE_PRESET_DEFAULTS,
    ...(form.presetValues || {})
  };
  return form;
}

export {initForm, FieldKind, FIELD_REGISTRY};
