import type {FieldCreationForm} from "./types";

export function freezeFormDefaults(seed: FieldCreationForm): FieldCreationForm {
  Object.freeze(seed.fieldValues);
  Object.freeze(seed.configurationValues);
  Object.freeze(seed.presetValues);
  if (seed.defaultValue) Object.freeze(seed.defaultValue);
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
  presetValues: BASE_PRESET_DEFAULTS
};
