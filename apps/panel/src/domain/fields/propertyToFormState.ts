/**
 * propertyToFormState
 * ------------------------------------------------------------
 * Converts an API BucketProperty (stored in bucket.properties)
 * back into a FieldFormState that can be used to pre-fill the
 * AddFieldModal when editing an existing field.
 *
 * Uses initForm() to deep-merge the extracted values onto the
 * field-kind's own creationFormDefaultValues, so only the keys
 * we explicitly know about are overridden.
 */

import {initForm} from ".";
import {inferSecurityFromAcl} from "./field-acl";
import {FieldKind, type FieldFormState, type InnerFieldFormState} from "./types";
import type {BucketSchema, BucketProperty} from "../../components/organisms/bucket-table/types";

/** Direct 1-to-1 mapping because FieldKind IS the API type string (string enum). */
function apiTypeToFieldKind(apiType: string): FieldKind {
  const knownKinds = new Set<string>(Object.values(FieldKind));
  if (knownKinds.has(apiType)) return apiType as FieldKind;
  // Fallback for unknown types (e.g. "encrypted", "hash")
  return FieldKind.String;
}

/**
 * Converts a nested inner-field API property to InnerFieldFormState.
 * Used for Object and Array-of-object fields.
 */
function innerPropertyToFormState(
  fieldKey: string,
  property: Record<string, any>
): InnerFieldFormState {
  const kind = apiTypeToFieldKind(property.type);
  const partial = buildPartialFormState(fieldKey, property, kind, undefined, undefined);
  const merged = initForm(kind, partial as FieldFormState);
  // initForm only carries keys present in the field-kind defaults; securityValues
  // is not seeded there, so re-apply it after the merge (mirrors innerFields).
  return {
    ...merged,
    securityValues: partial.securityValues,
    id: crypto.randomUUID()
  } as InnerFieldFormState;
}

/**
 * Builds a partial FieldFormState from an API property.
 * This covers universal fields + per-type specific fields.
 */
function buildPartialFormState(
  fieldKey: string,
  property: Record<string, any>,
  kind: FieldKind,
  required: string[] | undefined,
  primary: string | undefined,
  indexFlags: {index: boolean; uniqueValues: boolean} = {index: false, uniqueValues: false}
): Partial<FieldFormState> {
  const isRequired = required?.includes(fieldKey) ?? false;
  const isPrimary = primary === fieldKey;

  const baseFieldValues: Record<string, any> = {
    title: fieldKey,
    description: property.description ?? ""
  };

  const baseConfigValues: Record<string, any> = {
    translate: property.options?.translate ?? false,
    requiredField: isRequired,
    primaryField: isPrimary,
    index: indexFlags.index,
    uniqueValues: indexFlags.uniqueValues
  };

  let specificFieldValues: Record<string, any> = {};
  let specificConfigValues: Record<string, any> = {};
  let presetValues: Record<string, any> = {};
  let multipleSelectionTab: Record<string, any> | undefined;
  let defaultValue: any = undefined;
  let innerFields: InnerFieldFormState[] | undefined;

  switch (kind) {
    case FieldKind.String: {
      defaultValue = property.default ?? "";
      if (property.pattern) {
        presetValues.definePattern = true;
        presetValues.regularExpression = property.pattern;
      }
      if (Array.isArray(property.enum) && property.enum.length) {
        presetValues.makeEnumerated = true;
        presetValues.enumeratedValues = property.enum;
      }
      break;
    }

    case FieldKind.Number: {
      defaultValue = property.default;
      specificFieldValues.minimum = property.minimum;
      specificFieldValues.maximum = property.maximum;
      if (Array.isArray(property.enum) && property.enum.length) {
        specificFieldValues.makeEnumerated = true;
        specificFieldValues.enumeratedValues = property.enum;
      }
      break;
    }

    case FieldKind.Boolean: {
      defaultValue = property.default ?? false;
      break;
    }

    case FieldKind.Date: {
      defaultValue = property.default;
      break;
    }

    case FieldKind.Multiselect: {
      const enumValues: any[] = property.items?.enum ?? [];
      // Enum values are stored in presetValues.enumeratedValues (what the UI chip input binds to).
      presetValues.enumeratedValues = enumValues;
      presetValues.makeEnumerated = enumValues.length > 0;
      multipleSelectionTab = {
        multipleSelectionType: property.items?.type ?? "string",
        maxItems: property.maxItems
      };
      break;
    }

    case FieldKind.Relation: {
      specificFieldValues.bucket = property.bucketId ?? "";
      specificFieldValues.relationType = property.relationType ?? "";
      specificFieldValues.dependent = property.dependent ?? false;
      break;
    }

    case FieldKind.Array: {
      const itemType = property.items?.type ?? "";
      specificFieldValues.arrayType = itemType;
      specificFieldValues.arrayItemTitle = property.items?.title ?? "";
      specificFieldValues.arrayItemDescription = property.items?.description ?? "";
      specificFieldValues.maxItems = property.maxItems;
      specificFieldValues.minItems = property.minItems;
      specificFieldValues.uniqueItems = property.uniqueItems ?? false;
      defaultValue = property.items?.default;

      if (itemType === "number" || itemType === "string") {
        specificFieldValues.maxNumber = property.items?.maximum;
        specificFieldValues.minNumber = property.items?.minimum;
        if (Array.isArray(property.items?.enum) && property.items.enum.length) {
          specificFieldValues.makeEnumerated = true;
          presetValues.enumeratedValues = property.items.enum;
        }
        if (property.items?.pattern) {
          presetValues.definePattern = true;
          presetValues.regularExpression = property.items.pattern;
        }
      }

      if (itemType === "multiselect") {
        specificFieldValues.multipleSelectionType = property.items?.items?.type ?? "string";
        specificFieldValues.chip = property.items?.items?.enum ?? [];
      }

      if (itemType === "object" && property.items?.properties) {
        innerFields = Object.entries(
          property.items.properties as Record<string, Record<string, any>>
        ).map(([key, prop]) => innerPropertyToFormState(key, prop));
      }
      break;
    }

    case FieldKind.Object: {
      if (property.properties) {
        innerFields = Object.entries(
          property.properties as Record<string, Record<string, any>>
        ).map(([key, prop]) => innerPropertyToFormState(key, prop));
      }
      break;
    }

    case FieldKind.Color: {
      defaultValue = property.default ?? "";
      break;
    }

    // Textarea, Location, File, Richtext, Json — only base fields needed
    default:
      break;
  }

  const partial: Partial<FieldFormState> = {
    type: kind,
    fieldValues: {...baseFieldValues, ...specificFieldValues},
    configurationValues: {...baseConfigValues, ...specificConfigValues},
    presetValues,
    defaultValue,
    // No acl yields {mode: "everyone", expression: ""} so the security form is stable.
    securityValues: inferSecurityFromAcl(property.acl)
  };

  if (multipleSelectionTab !== undefined) {
    partial.multipleSelectionTab = multipleSelectionTab;
  }
  if (innerFields !== undefined) {
    partial.innerFields = innerFields;
  }

  return partial;
}

/**
 * Converts an API BucketProperty to a FieldFormState for pre-filling the edit modal.
 *
 * @param fieldKey - The property key in bucket.properties (= the field title)
 * @param property - The API property object
 * @param bucket   - The parent bucket (needed for required/primary metadata)
 */
/**
 * Reads the single-field index/uniqueness toggles for `fieldKey` out of the
 * bucket-level `indexes` array (where the API stores them). Mirrors the write
 * side in BucketTable's `applyFieldIndex`.
 */
function fieldIndexFlags(
  indexes: BucketSchema["indexes"],
  fieldKey: string
): {index: boolean; uniqueValues: boolean} {
  const single = (indexes ?? []).find((idx: any) => {
    const keys = Object.keys(idx?.definition ?? {});
    return keys.length === 1 && keys[0] === fieldKey;
  });
  return {index: !!single, uniqueValues: !!(single as any)?.options?.unique};
}

export function propertyToFieldFormState(
  fieldKey: string,
  property: BucketProperty,
  bucket: Pick<BucketSchema, "required" | "primary" | "indexes">
): FieldFormState {
  const kind = apiTypeToFieldKind(property.type);
  const partial = buildPartialFormState(
    fieldKey,
    property as Record<string, any>,
    kind,
    bucket.required,
    bucket.primary,
    fieldIndexFlags(bucket.indexes, fieldKey)
  );
  const merged = initForm(kind, partial as FieldFormState);
  if (partial.innerFields !== undefined) {
    merged.innerFields = partial.innerFields;
  }
  // securityValues is not part of the field-kind defaults initForm merges over,
  // so re-apply it here to keep the parsed acl on the edit form.
  merged.securityValues = partial.securityValues;
  return merged;
}

export {apiTypeToFieldKind};
