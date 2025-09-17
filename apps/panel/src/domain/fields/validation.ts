import * as Yup from "yup";
import {FieldKind} from "./types";
import type {Property} from "src/services/bucketService";
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
        const {minimum} = this.parent;
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
  ...BASE_FIELD_CREATION_FORM_SCHEMA
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
  ...BASE_FIELD_CREATION_FORM_SCHEMA
});
export const OBJECT_FIELD_CREATION_FORM_SCHEMA: ValidationSchema = Yup.object({
  ...BASE_FIELD_CREATION_FORM_SCHEMA
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
    p.pattern
      ? sch.matches(
          new RegExp(p.pattern),
          `This field does not match the required pattern "${p.pattern}"`
        )
      : sch
};

const numberConstraints = {
  required: (sch: Yup.NumberSchema, p: any) =>
    p.required ? sch.required("This field is required") : sch.notRequired(),
  enum: (sch: Yup.NumberSchema, p: any) =>
    Array.isArray(p.enum) ? sch.oneOf(p.enum, `Value must be one of: ${p.enum.join(", ")}`) : sch,
  minimum: (sch: Yup.NumberSchema, p: any) =>
    p.minimum !== undefined && p.minimum !== null
      ? sch.min(p.minimum, `Value must be greater than ${p.minimum}`)
      : sch,
  maximum: (sch: Yup.NumberSchema, p: any) =>
    p.maximum !== undefined && p.maximum !== null
      ? sch.max(p.maximum, `Value must be less than ${p.maximum}`)
      : sch
};

const dateConstraints = {
  required: (sch: Yup.DateSchema, p: any) =>
    p.required ? sch.required("This field is required") : sch.notRequired()
};

const booleanConstraints = {
  required: (sch: Yup.BooleanSchema, p: any) =>
    p.required ? sch.required("This field is required") : sch.notRequired()
};

const mixedConstraints = {
  required: (sch: Yup.MixedSchema, p: any) =>
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

const arrayConstraints = {
  required: (sch: any, p: any) =>
    p.required
      ? sch.required("This field is required").min(1, "This field is required")
      : sch.notRequired(),
  minItems: (sch: any, p: any) =>
    p.minItems !== undefined && p.minItems !== null
      ? sch.min(p.minItems, `Array must contain at least ${p.minItems} items`)
      : sch,
  maxItems: (sch: any, p: any) =>
    p.maxItems !== undefined && p.maxItems !== null
      ? sch.max(p.maxItems, `Array must contain at most ${p.maxItems} items`)
      : sch
};

const generateFieldValueSchema = (kind: FieldKind, property: Property) => {
  switch (kind) {
    case FieldKind.String:
    case FieldKind.Textarea:
    case FieldKind.Richtext:
    case FieldKind.Color:
      return applyConstraints(Yup.string(), property, stringConstraints);

    case FieldKind.Number:
      return applyConstraints(
        Yup.number().typeError("Value must be a number"),
        property,
        numberConstraints
      );

    case FieldKind.Boolean:
      return applyConstraints(Yup.boolean(), property, booleanConstraints);

    case FieldKind.Date:
      return applyConstraints(Yup.date(), property, dateConstraints);

    case FieldKind.Multiselect:
      return applyConstraints(Yup.array().of(Yup.mixed()), property, arrayConstraints);

    case FieldKind.Location:
      return applyConstraints(
        Yup.object({
          address: Yup.string().notRequired(),
          lat: Yup.number().notRequired(),
          lng: Yup.number().notRequired()
        }),
        property,
        mixedConstraints as any
      );

    case FieldKind.Array: {
      let arr: any = applyConstraints(Yup.array(), property, arrayConstraints);
      const itemType = property?.items?.type as FieldKind | undefined;
      const itemProps = property?.items;

      if (itemType && itemProps) {
        const baseItemSchema = generateFieldValueSchema(itemType, itemProps) as Yup.AnySchema;

        // For object arrays, we need to handle nested field errors with index information
        if (itemType === FieldKind.Object) {
          const enhancedObjectSchema = baseItemSchema
            .transform((value, originalValue, context) => {
              return originalValue;
            })
            .test({
              name: "object-with-index",
              message: "Validation failed",
              test: function (value, context) {
                try {
                  baseItemSchema.validateSync(value, {abortEarly: false});
                  return true;
                } catch (error) {
                  if (error instanceof Yup.ValidationError) {
                    const pathParts = context.path.split(".");
                    const arrayIndex = pathParts[pathParts.length - 1];

                    // Get the first error to create a meaningful message
                    const firstError = error.inner[0] || error;
                    const fieldPath = firstError.path;
                    const fieldName = fieldPath ? fieldPath.split(".").pop() : "field";

                    return context.createError({
                      message: `${fieldName} at index ${arrayIndex.replace(/\[|\]/g, "")} ${firstError.message.replace(/^this field /i, "").replace(/^This field /i, "")}`
                    });
                  }
                  return false;
                }
              }
            });

          arr = arr.of(enhancedObjectSchema);
        } else {
          // For primitive arrays, add index information
          const enhancedPrimitiveSchema = baseItemSchema.test({
            name: "primitive-with-index",
            message: "Validation failed",
            test: function (value, context) {
              try {
                baseItemSchema.validateSync(value);
                return true;
              } catch (error) {
                if (error instanceof Yup.ValidationError) {
                  const pathParts = context.path.split(".");
                  const arrayIndex = pathParts[pathParts.length - 1];

                  return context.createError({
                    message: `Item at index ${arrayIndex} ${error.message.replace(/^Value /i, "").replace(/^This field /i, "")}`
                  });
                }
                return false;
              }
            }
          });

          arr = arr.of(enhancedPrimitiveSchema);
        }
      } else {
        arr = arr.of(Yup.mixed());
      }
      return arr;
    }

    case FieldKind.Object: {
      const props: Record<string, any> | undefined = property?.properties;
      let obj: any = Yup.object();
      if (props && typeof props === "object") {
        const requiredKeys = Array.isArray(property?.required)
          ? (property.required as string[])
          : [];
        const shape: Record<string, Yup.AnySchema> = {};
        for (const [k, childProp] of Object.entries(props)) {
          const childKind = childProp?.type as FieldKind | undefined;
          let childSchema: Yup.AnySchema;
          if (childKind) {
            childSchema = generateFieldValueSchema(childKind, childProp) as Yup.AnySchema;
          } else {
            childSchema = Yup.mixed();
          }
          shape[k] = requiredKeys.includes(k)
            ? childSchema.required("This field is required")
            : childSchema.notRequired();
        }
        obj = obj.shape(shape);
      }
      if (property?.required === true) {
        obj = obj
          .required("This field is required")
          .test(
            "object-non-empty",
            "This field is required",
            (val: unknown) =>
              val != null &&
              typeof val === "object" &&
              Object.keys(val as Record<string, any>).length > 0
          );
      } else {
        obj = obj.notRequired();
      }
      return obj;
    }

    case FieldKind.File:
      return applyConstraints(Yup.mixed(), property, mixedConstraints);

    case FieldKind.Json:
      return applyConstraints(Yup.mixed(), property, mixedConstraints);

    case FieldKind.Relation:
      return applyConstraints(Yup.string(), property, stringConstraints);

    default:
      return Yup.mixed().notRequired();
  }
};

export const validateFieldValue = (
  value: any,
  kind: FieldKind,
  properties: Property
): string | null => {
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
// Low-level Yup runner kept last for readability
// --------------------------------------------------
export function runYupValidation(
  schema: ValidationSchema,
  form: any
): Record<string, string> | null {
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
