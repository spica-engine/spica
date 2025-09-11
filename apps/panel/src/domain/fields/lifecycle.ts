/**
 * Field Form Lifecycle Utilities
 * ------------------------------------------------------------
 * Consolidates reinitialization & structural shaping behaviors
 * previously embedded in UI components (Step 3 of refactor plan).
 */
import {fieldDomain} from ".";
import {BASE_PRESET_DEFAULTS} from "./defaults";
import {FieldKind, type FieldFormState, type FieldFormDefaults} from "./types";

export interface ReinitFormOptions {
  inner?: boolean;
  previousForm?: Partial<FieldFormState>; // reserved for future value carry-over
  initial?: Partial<FieldFormDefaults & {type?: FieldKind; innerFields?: any[]}>;
}

/**
 * Ensures required preset keys are present, removes unsupported capability
 * fields, and guarantees title/description string presence.
 */
export function coerceFieldShape(form: FieldFormState): FieldFormState {
  const def = fieldDomain.getFieldDefinition(form.type as FieldKind);
  const caps = def?.capabilities || {};
  const next: FieldFormState = {
    ...form,
    fieldValues: {
      title: (form.fieldValues?.title ?? "") as string,
      description: (form.fieldValues?.description ?? "") as string,
      ...form.fieldValues
    },
    presetValues: {
      ...BASE_PRESET_DEFAULTS,
      ...(form.presetValues || {})
    }
  };
  // Prune enumeration support if capability absent
  if (!caps.enumerable) {
    delete (next.presetValues as any).enumeratedValues;
    (next.presetValues as any).makeEnumerated = false;
  }
  // Prune pattern support if capability absent
  if (!caps.pattern) {
    delete (next.presetValues as any).regularExpression;
    (next.presetValues as any).definePattern = false;
  }
  return next;
}

/**
 * Determines if the field kind structurally requires at least one inner
 * field (object or array-of-object).
 */
export function requiresInnerFields(kind: FieldKind, form?: {fieldValues?: Record<string, any>}): boolean {
  if (kind === FieldKind.Object) return true;
  if (kind === FieldKind.Array && form?.fieldValues?.arrayType === "object") return true;
  return false;
}