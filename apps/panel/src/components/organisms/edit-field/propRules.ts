import type {FieldTypeRule} from "./types";

export const propRules: Record<string, FieldTypeRule> = {
  string: {
    canBePrimary: true,
    canBeUnique: true,
    canBeRequired: true,
    canBeIndexed: true,
    canBeTranslatable: true,
    hasDefaultValue: true
  },
  number: {
    canBePrimary: true,
    canBeUnique: true,
    canBeRequired: true,
    canBeIndexed: true,
    canBeTranslatable: false,
    hasDefaultValue: true,
    hasMinMax: true,
    hasEnumeration: true
  },
  boolean: {
    canBePrimary: true,
    canBeUnique: false,
    canBeRequired: false,
    canBeIndexed: true,
    canBeTranslatable: false,
    hasDefaultValue: true
  },
  textarea: {
    canBePrimary: true,
    canBeUnique: true,
    canBeRequired: true,
    canBeIndexed: true,
    canBeTranslatable: true,
    hasDefaultValue: false
  },
  select: {
    canBePrimary: false,
    canBeUnique: false,
    canBeRequired: true,
    canBeIndexed: true,
    canBeTranslatable: false,
    hasDefaultValue: false,
    hasPresets: true,
    hasMultipleSelection: true
  },
  date: {
    canBePrimary: false,
    canBeUnique: false,
    canBeRequired: true,
    canBeIndexed: true,
    canBeTranslatable: false,
    hasDefaultDate: true
  }
};

