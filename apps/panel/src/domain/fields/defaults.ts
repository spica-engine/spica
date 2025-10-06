import { FIELD_REGISTRY } from "./registry";
import type {FieldCreationForm, FieldKind} from "./types";

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

export function makeInnerFieldDefaults(kind: FieldKind): FieldCreationForm {
  const base = FIELD_REGISTRY[kind]?.creationFormDefaultValues;
  if (!base) throw new Error(`makeInnerFieldDefaults: unknown field kind '${kind}'`);
  return {
    ...base,
    fieldValues: {
      ...base.fieldValues,
      title: "New Inner Field",
      description: ""
    }
  };
}

export const DEFAULT_COORDINATES = {lat: 36.8969, lng: 30.7133}; // Default to Antalya, Turkiye
