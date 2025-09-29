import * as Yup from "yup";
import {FieldKind} from "./types";
export type ValidationSchema = Yup.ObjectSchema<any>;

export const TITLE_REGEX = /^(?!(_id)$)([a-z_0-9]*)+$/; // lowercase, digits, underscore, not _id

const BASE_FIELD_CREATION_FORM_SCHEMA = {
  fieldValues: Yup.object({
    title: Yup.string()
      .required("Title is required")
      .matches(
        TITLE_REGEX,
        "Title can be only lowercase letters, numbers, and underscores, and cannot be '_id' or an empty string"
      ),
    description: Yup.string().optional()
  })
};

export const STRING_FIELD_CREATION_FORM_SCHEMA: ValidationSchema = Yup.object({
  ...BASE_FIELD_CREATION_FORM_SCHEMA,
  presetValues: Yup.object({
    makeEnumerated: Yup.boolean().default(false),
    enumeratedValues: Yup.array()
      .of(Yup.string())
      .when("makeEnumerated", {
        is: true,
        then: sch =>
          sch
            .min(1, "At least one value")
            .test(
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
        sch.min(1, "Pattern required").test("valid-regex", "Invalid pattern", val => {
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
export const NUMBER_FIELD_CREATION_FORM_SCHEMA: ValidationSchema = Yup.object({
  ...BASE_FIELD_CREATION_FORM_SCHEMA,
  fieldValues: (BASE_FIELD_CREATION_FORM_SCHEMA.fieldValues as Yup.ObjectSchema<any>).shape({
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
      .test("no-empty-values", "Empty values not allowed", arr => !arr || !arr.some(v => v === ""))
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
        sch.min(1, "Pattern required").test("valid-regex", "Invalid pattern", val => {
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
export const BOOLEAN_FIELD_CREATION_FORM_SCHEMA: ValidationSchema = Yup.object({
  ...BASE_FIELD_CREATION_FORM_SCHEMA
});
export const DATE_FIELD_CREATION_FORM_SCHEMA: ValidationSchema = Yup.object({
  ...BASE_FIELD_CREATION_FORM_SCHEMA
});
export const TEXTAREA_FIELD_CREATION_FORM_SCHEMA: ValidationSchema = Yup.object({
  ...BASE_FIELD_CREATION_FORM_SCHEMA
});
export const MULTISELECT_FIELD_CREATION_FORM_SCHEMA: ValidationSchema = Yup.object({
  ...BASE_FIELD_CREATION_FORM_SCHEMA,
  multipleSelectionTab: Yup.object({
    multipleSelectionType: Yup.string().required("Multiple Selection Type is required")
  })
});
export const RELATION_FIELD_CREATION_FORM_SCHEMA: ValidationSchema = Yup.object({
  fieldValues: (BASE_FIELD_CREATION_FORM_SCHEMA.fieldValues as Yup.ObjectSchema<any>).shape({
    bucket: Yup.string().required("Bucket is required"),
    relationType: Yup.string().required("Relation Type is required"),
    dependent: Yup.boolean().optional(),
    title: Yup.string().required("Title is required"),
    description: Yup.string().optional()
  })
});
export const LOCATION_FIELD_CREATION_FORM_SCHEMA: ValidationSchema = Yup.object({
  ...BASE_FIELD_CREATION_FORM_SCHEMA
});
export const ARRAY_FIELD_CREATION_FORM_SCHEMA: ValidationSchema = Yup.object({
  ...BASE_FIELD_CREATION_FORM_SCHEMA,
  innerFields: Yup.array().when("fieldValues.arrayType", {
    is: "object",
    then: sch => sch.min(1, "At least one inner field is required"),
    otherwise: sch => sch.optional()
  }),
  fieldValues: (BASE_FIELD_CREATION_FORM_SCHEMA.fieldValues as Yup.ObjectSchema<any>).shape({
    arrayType: Yup.string().required("Array Type is required"),
    multipleSelectionType: Yup.string().when("arrayType", {
      is: "multiselect",
      then: sch => sch.required("Multiple Selection Type is required"),
      otherwise: sch => sch.optional()
    })
  })
});
export const OBJECT_FIELD_CREATION_FORM_SCHEMA: ValidationSchema = Yup.object({
  ...BASE_FIELD_CREATION_FORM_SCHEMA,
  innerFields: Yup.array()
    .min(1, "At least one inner field is required")
    .required("Inner fields are required")
});
export const FILE_FIELD_CREATION_FORM_SCHEMA: ValidationSchema = Yup.object({
  ...BASE_FIELD_CREATION_FORM_SCHEMA
});
export const RICHTEXT_FIELD_CREATION_FORM_SCHEMA: ValidationSchema = Yup.object({
  ...BASE_FIELD_CREATION_FORM_SCHEMA
});
export const JSON_FIELD_CREATION_FORM_SCHEMA: ValidationSchema = Yup.object({
  ...BASE_FIELD_CREATION_FORM_SCHEMA
});
export const COLOR_FIELD_CREATION_FORM_SCHEMA: ValidationSchema = Yup.object({
  ...BASE_FIELD_CREATION_FORM_SCHEMA
});

const stringConstraints = {
  required: (sch: Yup.StringSchema, p: any) =>
    p.required ? sch.required("This field is required") : sch.notRequired(),

  enum: (sch: Yup.StringSchema, p: any) =>
    Array.isArray(p.enum) ? sch.oneOf(p.enum, `Value must be one of: ${p.enum.join(", ")}`) : sch,

  pattern: (sch: Yup.StringSchema, p: any) =>
    p.pattern ? sch.matches(new RegExp(p.pattern), `Must match pattern: ${p.pattern}`) : sch
};

const numberConstraints = {
  required: (sch: Yup.NumberSchema, p: any) =>
    p.required ? sch.required("This field is required") : sch.notRequired()
  // could add min, max later if you want
};

const dateConstraints = {
  required: (sch: Yup.DateSchema, p: any) =>
    p.required ? sch.required("This field is required") : sch.notRequired()
};

// … you can extend this for Boolean, Array, etc.

// ---- helper to apply constraints ----

function applyConstraints<T extends Yup.AnySchema>(
  schema: T,
  property: any,
  registry: Record<string, (sch: any, p: any) => any>
): T {
  let current = schema;
  for (const key of Object.keys(property)) {
    const fn = registry[key];
    if (fn) {
      current = fn(current, property);
    }
  }
  return current;
}

const generateFieldValueSchema = (kind: FieldKind, property: any) => {
  switch (kind) {
    case FieldKind.String:
    case FieldKind.Textarea:
    case FieldKind.Richtext:
    case FieldKind.Color:
      return applyConstraints(Yup.string(), property, stringConstraints);

    case FieldKind.Number:
      return applyConstraints(Yup.number(), property, numberConstraints);

    case FieldKind.Boolean:
      return Yup.boolean().notRequired(); // could add required constraint if you want

    case FieldKind.Date:
      return applyConstraints(Yup.date(), property, dateConstraints);

    case FieldKind.Multiselect:
      return Yup.array().of(Yup.mixed()).notRequired();

    case FieldKind.Location:
      return Yup.object({
        address: Yup.string().notRequired(),
        lat: Yup.number().notRequired(),
        lng: Yup.number().notRequired()
      }).notRequired();

    case FieldKind.Array:
      return Yup.array().notRequired();

    case FieldKind.Object:
      return Yup.object().notRequired();

    case FieldKind.File:
      return Yup.mixed().notRequired();

    case FieldKind.Json:
      return Yup.mixed().notRequired();

    case FieldKind.Relation:
      return Yup.mixed().notRequired();

    default:
      return Yup.mixed().notRequired();
  }
};

export const validateFieldValue = (value: any, kind: FieldKind, properties: any): string | null => {
  const schema = generateFieldValueSchema(kind, properties);
  try {
    schema.validateSync(value, {abortEarly: true}); // only first error
    return null;
  } catch (error) {
    if (error instanceof Yup.ValidationError) {
      return error.message;
    }
    return "Validation failed"; // fallback just in case
  }
};

// ---------------------------------------------------------------------------
// Helper function to convert flat error paths to nested object structure
// --------------------------------------------------
function createNestedErrorObject(flatErrors: Record<string, string>): any {
  const result: any = {};

  for (const [path, message] of Object.entries(flatErrors)) {
    const keys = path.split(".");
    let current = result;

    // Navigate/create the nested structure
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!(key in current)) {
        current[key] = {};
      }
      current = current[key];
    }

    // Set the final value
    const lastKey = keys[keys.length - 1];
    current[lastKey] = message;
  }

  return result;
}

// ---------------------------------------------------------------------------
// Low-level Yup runner kept last for readability
// --------------------------------------------------
export function runYupValidation(schema: ValidationSchema, form: any): Record<string, string> | null {
  try {
    schema.validateSync(form, {abortEarly: false, stripUnknown: false});
    return null;
  } catch (err) {
    if (err instanceof Yup.ValidationError) {
      const flatErrors: Record<string, string> = {};
      for (const e of err.inner) {
        if (e.path && !flatErrors[e.path]) flatErrors[e.path] = e.message;
      }
      if (!err.inner.length && err.path) flatErrors[err.path] = err.message;

      if (Object.keys(flatErrors).length === 0) return null;

      // Convert flat errors to nested structure
      return createNestedErrorObject(flatErrors);
    }
    return {__root: "Validation failed"};
  }
}
