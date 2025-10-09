import {FIELD_REGISTRY} from "./registry";
import {BASE_PRESET_DEFAULTS} from "./defaults";
import {FieldKind, type FieldDefinition, type FieldFormState} from "./types";

function initForm(kind: FieldKind, initialValues?: FieldFormState) {
  const seed = FIELD_REGISTRY[kind as FieldKind]?.creationFormDefaultValues;
  if (!seed) throw new Error(`initForm: unknown field kind '${kind}'`);

  const deepMerge = (target: any, src: any) => {
    if (!src) return target;
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

  const initial = initialValues || ({} as FieldFormState);

  const merged = {
    ...(Object.fromEntries(
      Object.entries(seed).map(([k, v]) => [
        k,
        deepMerge({...v}, initial[k as keyof FieldFormState])
      ])
    ) as Omit<FieldFormState, "type" | "defaultValue">),
    defaultValue: initial.defaultValue || seed.defaultValue,
    type: kind
  };

  // Capability-based sanitization (enumeration / pattern fields removed when unsupported)
  const def = FIELD_REGISTRY[kind];
  return sanitizeFormByCapabilities(merged, def);
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
    delete form.presetValues.regularExpression;
  }
  // Rehydrate missing base keys to avoid undefined access in UI layers
  form.presetValues = {
    ...BASE_PRESET_DEFAULTS,
    ...form.presetValues
  };
  return form;
}

import {
  addInnerField,
  updateInnerField,
  removeInnerField,
} from "./inner-fields";
import type { Property } from "src/services/bucketService";

export {
  addInnerField,
  updateInnerField,
  removeInnerField,
  FieldKind,
  initForm,
  FIELD_REGISTRY
};


export function buildBaseProperty(values: FieldFormState): Property {
  const {fieldValues, configurationValues, type, innerFields} = values;
  return {
    type,
    title: fieldValues.title,
    description: fieldValues.description || undefined,
    options: {
      position: "bottom",
      index: configurationValues.index || undefined,
      unique: configurationValues.uniqueValues || undefined,
      translate: configurationValues.translate || undefined
    },
    required:
      innerFields && innerFields.length > 0
        ? innerFields
            .filter(i => i.configurationValues.requiredField)
            ?.map?.(i => i.fieldValues.title)
        : undefined
  } as Property;
}