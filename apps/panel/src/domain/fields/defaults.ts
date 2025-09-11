import {getFieldDefinition} from "./registry";
import {FieldKind, type FieldFormDefaults} from "./types";

export function cloneFormDefaults(seed: FieldFormDefaults): FieldFormDefaults {
  return {
    fieldValues: {...seed.fieldValues},
    configurationValues: {...seed.configurationValues},
    presetValues: {...seed.presetValues},
    defaultValue: {...seed.defaultValue}
  };
}

export function freezeFormDefaults(seed: FieldFormDefaults): FieldFormDefaults {
  Object.freeze(seed.fieldValues);
  Object.freeze(seed.configurationValues);
  Object.freeze(seed.presetValues);
  Object.freeze(seed.defaultValue);
  return Object.freeze(seed);
}

export const BASE_PRESET_DEFAULTS = {
  preset: "",
  makeEnumerated: false,
  enumeratedValues: [] as string[],
  definePattern: false,
  regularExpression: ""
} as const;

export const BASE_FORM_DEFAULTS = {
  fieldValues: {
    title: "",
    description: ""
  },
  configurationValues: {},
  presetValues: BASE_PRESET_DEFAULTS,
  defaultValue: {}
};

// ---------------------------------------------------------------------------
// Unified Accessors
// ---------------------------------------------------------------------------

export function getFieldDefaults(kind: FieldKind): FieldFormDefaults {
  const def = getFieldDefinition(kind);
  if (!def) throw new Error(`Field definition not found for kind '${kind}'`);
  // Deep clone via existing helper (preserves nested object identity safety)
  return cloneFormDefaults(def.formDefaults);
}

export function makeInnerFieldDefaults(kind: FieldKind): FieldFormDefaults {
  const base = getFieldDefaults(kind);
  return {
    ...base,
    fieldValues: {
      ...base.fieldValues,
      title: "New Inner Field",
      description: ""
    }
  };
}

export function resolveDefault(form: FieldFormDefaults, candidates: string[]) {
  for (const c of candidates)
    if (Object.prototype.hasOwnProperty.call(form.defaultValue, c))
      return (form.defaultValue as any)[c];
  return undefined;
}
