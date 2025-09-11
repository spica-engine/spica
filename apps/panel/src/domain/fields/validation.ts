import * as Yup from "yup";
import type {FieldDefinition} from "./types";
import {FieldKind} from "./types";
/**
 * Field Form Validation
 * ------------------------------------------------------------
 * Provides: (1) reusable Yup schemas per field kind, (2) higher-level
 * form validation that layers generic naming rules and registry hooks.
 */

// ---------------------------------------------------------------------------
// Types & Core Exports
// ---------------------------------------------------------------------------
export type ValidationSchema = Yup.ObjectSchema<any>;


// Base fragment shared by all per-kind schemas
export const TITLE_BLOCK = {
  fieldValues: Yup.object({
    title: Yup.string().required("Title is required"),
    description: Yup.string().optional()
  })
};

// Per-kind Yup schemas
export const STRING_SCHEMA: ValidationSchema = Yup.object({
  ...TITLE_BLOCK,
  presetValues: Yup.object({
    makeEnumerated: Yup.boolean().default(false),
    enumeratedValues: Yup.array()
      .of(Yup.string())
      .when("makeEnumerated", {
        is: true,
        then: sch =>
          sch.min(1, "At least one value").test(
            "no-empty-string",
            "Empty values not allowed",
            arr => !arr || !arr.some(v => v === "")
          ),
        otherwise: sch => sch
      }),
    definePattern: Yup.boolean().default(false),
    regularExpression: Yup.string().when("definePattern", {
      is: true,
      then: sch =>
        sch
          .min(1, "Pattern required")
          .test("valid-regex", "Invalid pattern", val => {
            if (!val) return false;
            try {
              new RegExp(val);
              return true;
            } catch {
              return false;
            }
          }),
      otherwise: sch => sch.optional()
    })
  }).required()
});

export const NUMBER_SCHEMA: ValidationSchema = Yup.object({
  ...TITLE_BLOCK,
  fieldValues: (TITLE_BLOCK.fieldValues as Yup.ObjectSchema<any>).shape({
    minimum: Yup.number().nullable().optional(),
    maximum: Yup.number()
      .nullable()
      .optional()
      .test("max>=min", "Max must be >= Min", function (value) {
        const {minimum} = this.parent as any;
        if (value == null || minimum == null) return true;
        return value >= minimum;
      }),
    enumeratedValues: Yup.array()
      .of(Yup.mixed())
      .test(
        "no-empty-values",
        "Empty values not allowed",
        arr => !arr || !arr.some(v => v === "")
      )
      .test(
        "all-numeric",
        "All values must be numeric",
        arr => !arr || arr.every(v => !isNaN(Number(v)))
      )
      .optional()
  }),
  presetValues: Yup.object({
    definePattern: Yup.boolean().default(false),
    regularExpression: Yup.string().when("definePattern", {
      is: true,
      then: sch =>
        sch
          .min(1, "Pattern required")
          .test("valid-regex", "Invalid pattern", val => {
            if (!val) return false;
            try {
              new RegExp(val);
              return true;
            } catch {
              return false;
            }
          }),
      otherwise: sch => sch.optional()
    })
  }).required()
});

export const BOOLEAN_SCHEMA: ValidationSchema = Yup.object({...TITLE_BLOCK});
export const DATE_SCHEMA: ValidationSchema = Yup.object({...TITLE_BLOCK});
export const TEXTAREA_SCHEMA: ValidationSchema = Yup.object({...TITLE_BLOCK});
export const MULTISELECT_SCHEMA: ValidationSchema = Yup.object({...TITLE_BLOCK});
export const RELATION_SCHEMA: ValidationSchema = Yup.object({
  fieldValues: (TITLE_BLOCK.fieldValues as Yup.ObjectSchema<any>).shape({
    bucket: Yup.string().required("Bucket is required"),
    relationType: Yup.string().optional(),
    dependent: Yup.boolean().optional(),
    title: Yup.string().required("Title is required"),
    description: Yup.string().optional()
  })
});
export const LOCATION_SCHEMA: ValidationSchema = Yup.object({...TITLE_BLOCK});
export const ARRAY_SCHEMA: ValidationSchema = Yup.object({...TITLE_BLOCK});
export const OBJECT_SCHEMA: ValidationSchema = Yup.object({...TITLE_BLOCK});
export const FILE_SCHEMA: ValidationSchema = Yup.object({...TITLE_BLOCK});
export const RICHTEXT_SCHEMA: ValidationSchema = Yup.object({...TITLE_BLOCK});
export const JSON_SCHEMA: ValidationSchema = Yup.object({...TITLE_BLOCK});
export const COLOR_SCHEMA: ValidationSchema = Yup.object({...TITLE_BLOCK});

// Central schema map for facade usage
// DEPRECATED: FIELD_VALIDATION_SCHEMAS retained temporarily for legacy callers. New code should rely on per-definition validate() only.
export const FIELD_VALIDATION_SCHEMAS: Record<FieldKind, ValidationSchema> = {
  [FieldKind.String]: STRING_SCHEMA,
  [FieldKind.Number]: NUMBER_SCHEMA,
  [FieldKind.Boolean]: BOOLEAN_SCHEMA,
  [FieldKind.Date]: DATE_SCHEMA,
  [FieldKind.Textarea]: TEXTAREA_SCHEMA,
  [FieldKind.Multiselect]: MULTISELECT_SCHEMA,
  [FieldKind.Relation]: RELATION_SCHEMA,
  [FieldKind.Location]: LOCATION_SCHEMA,
  [FieldKind.Array]: ARRAY_SCHEMA,
  [FieldKind.Object]: OBJECT_SCHEMA,
  [FieldKind.File]: FILE_SCHEMA,
  [FieldKind.Richtext]: RICHTEXT_SCHEMA,
  [FieldKind.Json]: JSON_SCHEMA,
  [FieldKind.Color]: COLOR_SCHEMA
};


// High-level form validation wrapper merges:
//  * generic name rules (format + reserved list)
//  * per-kind registry validation (enumerations, patterns, constraints)
//  * structure rules (object / array-of-object must have inner fields)

export const PROPERTY_NAME_REGEX = /^(?!(_id)$)([a-z_0-9]*)+$/; // lowercase, digits, underscore, not _id

// Minimal shape reused by UI (mirrors previous FormErrors structure)
export interface FieldFormErrors {
  fieldValues?: Record<string, string>;
  presetValues?: Record<string, string>; // kept for backward compatibility (registry may add)
  configurationValues?: Record<string, string>;
  defaultValue?: Record<string, string>;
  innerFields?: string;
}

// (Deprecated shim interfaces removed – facade.validateForm is the sole API.)

// Thin helper for direct registry-level validation (bypasses wrapper)
export function validateField(def: FieldDefinition, form: any) {
  if (!def?.validate) return null;
  return def.validate(form as any) || null;
}

// ---------------------------------------------------------------------------
// Low-level Yup runner kept last for readability
// ---------------------------------------------------------------------------
export function runYupValidation(schema: ValidationSchema, form: any): Record<string, string> | null {
  try {
    schema.validateSync(form, {abortEarly: false, stripUnknown: false});
    return null;
  } catch (err) {
    if (err instanceof Yup.ValidationError) {
      const out: Record<string, string> = {};
      for (const e of err.inner) {
        if (e.path && !out[e.path]) out[e.path] = e.message;
      }
      if (!err.inner.length && err.path) out[err.path] = err.message;
      return Object.keys(out).length ? out : null;
    }
    return {__root: "Validation failed"};
  }
}
