import type {Property, Properties} from "src/services/bucketService";
import type {FieldRegistry} from "src/domain/fields/types";

export class BucketEntryTransformer {
  constructor(private fieldRegistry: FieldRegistry) {}


  generateInitialValues(properties: Properties): Record<string, any> {
    return Object.keys(properties).reduce(
      (acc: Record<string, any>, key) => {
        const property = properties[key];
        const field = this.fieldRegistry[property.type];
        
        if (property.type === "object" && property.properties) {
          acc[key] = this.generateInitialValues(property.properties);
        } else if (field) {
          acc[key] = field.getDefaultValue(property);
        } else {
          acc[key] = undefined;
        }
        
        return acc;
      },
      {} as Record<string, any>
    );
  }

  normalizeForSave(
    value: Record<string, any>,
    properties: Properties
  ): Record<string, any> {
    const normalized: Record<string, any> = {};

    for (const [key, property] of Object.entries(properties || {})) {
      const kind = property.type;
      const field = this.fieldRegistry[kind];
      
      if (field) {
        normalized[key] = field.getSaveReadyValue(value[key], property);
      } else {
        normalized[key] = value[key];
      }
    }

    return normalized;
  }

  cleanValue(
    val: any,
    property: Property,
    required?: boolean,
    preferUndefined?: boolean
  ): any {
    if (property?.type === "object" && property.properties) {
      const entries = Object.entries(val || {}).map(([key, value]) => {
        const schema = property.properties[key];
        const isRequired = property.required?.includes(key);
        const cleanedValue = schema
          ? this.cleanValue(value, schema, isRequired, true)
          : value;
        return [key, cleanedValue];
      });
      return Object.fromEntries(entries);
    } else if (property?.type === "array" && property.items) {
      if (!Array.isArray(val)) return val;
      return val.map(v => this.cleanValue(v, property.items));
    }

    return this.cleanSimpleValue(val, property?.type, required || false, preferUndefined || false);
  }

  cleanAllValues(
    normalized: Record<string, any>,
    properties: Properties,
    requiredFields: string[]
  ): Record<string, any> {
    return Object.fromEntries(
      Object.entries(normalized).map(([key, val]) => [
        key,
        this.cleanValue(val, properties[key], requiredFields?.includes(key), true)
      ])
    );
  }

  private cleanSimpleValue(
    value: any,
    type: string,
    required: boolean,
    preferUndefined?: boolean
  ): any {
    if (type === "location" && value) {
      return {type: "Point", coordinates: [value.lat, value.lng]};
    }

    if (type === "array") {
      return value?.length === 1 && value[0] === "" ? undefined : value;
    }

    if (type === "relation") {
      return Array.isArray(value) ? value.map(v => v.value) : value?.value;
    }

    if (type === "object") {
      const cleanedObject = Object.fromEntries(
        Object.entries(value).map(([key, value]) => {
          const isValueEmpty = value === "" || (Array.isArray(value) && value.length === 0);
          return [key, isValueEmpty ? undefined : value];
        })
      );
      return this.isObjectEffectivelyEmpty(cleanedObject) ? undefined : cleanedObject;
    }

    return value === "" ? (required ? undefined : preferUndefined ? undefined : value) : value;
  }

  private isObjectEffectivelyEmpty(obj: Record<string, any>): boolean {
    if (obj == null || typeof obj !== "object") return true;

    return Object.keys(obj).every(
      key =>
        obj[key] === undefined ||
        obj[key] === null ||
        (typeof obj[key] === "object" && this.isObjectEffectivelyEmpty(obj[key]))
    );
  }
}

