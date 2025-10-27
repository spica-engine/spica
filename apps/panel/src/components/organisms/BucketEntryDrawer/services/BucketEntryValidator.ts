import type {Property, Properties} from "src/services/bucketService";
import type {FieldRegistry} from "src/domain/fields/types";

export type ValidationErrors = {
  [key: string]: string | ValidationErrors | undefined;
};

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationErrors;
}

export class BucketEntryValidator {
  constructor(private fieldRegistry: FieldRegistry) {}

  validate(
    value: Record<string, any>,
    properties: Properties,
    requiredFields: string[]
  ): ValidationResult {
    const errors: ValidationErrors = {};

    for (const [key, property] of Object.entries(properties || {})) {
      const kind = property.type;
      const field = this.fieldRegistry[kind];
      
      if (!field) {
        continue;
      }

      const val = field.getSaveReadyValue(value[key], property);
      const required = requiredFields?.includes(key) ? true : property.required;
      const msg = field.validateValue(val, property, required);
      
      if (msg) {
        errors[key] = msg as string;
      }
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors
    };
  }

  findFirstErrorId(
    errors: ValidationErrors,
    properties: Properties,
    prefix = ""
  ): string | null {
    for (const [key, error] of Object.entries(errors)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      const property = properties[key];

      if (typeof error === "string" && property?.id) {
        return property.id;
      } else if (typeof error === "object" && property?.properties) {
        const nestedId = this.findFirstErrorId(error, property.properties, fullKey);
        if (nestedId) return nestedId;
      }
    }
    return null;
  }
}

