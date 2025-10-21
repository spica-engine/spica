import * as Yup from "yup";
import {FieldKind, type FieldFormState, type FormError} from "./types";
import type {TypeInputRepresenterError} from "oziko-ui-kit/dist/custom-hooks/useInputRepresenter";
import type {Property} from "src/store/api/bucketApi";
export type ValidationSchema = Yup.ObjectSchema<Record<string, unknown>>;

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
        then: schema =>
          schema
            .min(1, "At least one value")
            .test(
              "no-empty-string",
              "Empty values not allowed",
              arr => !arr || !arr.some(v => v === "")
            ),
        otherwise: schema => schema
      }),
    definePattern: Yup.boolean().default(false),
    regularExpression: Yup.string().when("definePattern", {
      is: true,
      then: schema =>
        schema.min(1, "Pattern required").test("valid-regex", "Invalid pattern", val => {
          if (!val) return false;
          try {
            new RegExp(val);
            return true;
          } catch {
            return false;
          }
        }),
      otherwise: schema => schema.optional()
    })
  }).required()
});
export const NUMBER_FIELD_CREATION_FORM_SCHEMA: ValidationSchema = Yup.object({
  ...BASE_FIELD_CREATION_FORM_SCHEMA,
  fieldValues: (
    BASE_FIELD_CREATION_FORM_SCHEMA.fieldValues as Yup.ObjectSchema<Record<string, unknown>>
  ).shape({
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
      then: schema =>
        schema.min(1, "Pattern required").test("valid-regex", "Invalid pattern", val => {
          if (!val) return false;
          try {
            new RegExp(val);
            return true;
          } catch {
            return false;
          }
        }),
      otherwise: schema => schema.optional()
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
  fieldValues: (
    BASE_FIELD_CREATION_FORM_SCHEMA.fieldValues as Yup.ObjectSchema<Record<string, unknown>>
  ).shape({
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
  fieldValues: (BASE_FIELD_CREATION_FORM_SCHEMA.fieldValues).shape({
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

type Constraint = Record<
  string,
  (
    schema: Yup.AnySchema,
    property: Omit<Property, "required"> & {required?: boolean}
  ) => Yup.AnySchema
>;

const stringConstraints = {
  required: (schema: Yup.StringSchema, property: Property & {required?: boolean}) =>
    property.required
      ? schema.required("This field is required").min(1, "This field is required")
      : schema.optional(),

  enum: (schema: Yup.StringSchema, property: Property) =>
    Array.isArray(property.enum)
      ? schema.test(
          "enum-or-empty",
          `Value must be one of: ${property.enum.join(", ")}`,
          function (val) {
            if (val === "" || val == null) {
              if (!property.required) return true;
              return false;
            }
            return property.enum!.includes(val);
          }
        )
      : schema,

  pattern: (schema: Yup.StringSchema, property: Property) =>
    property.pattern
      ? schema.test(
          "pattern-or-empty",
          `This field does not match the required pattern "${property.pattern}"`,
          function (val) {
            if (val === "" || val == null) {
              return !property.required;
            }
            return new RegExp(property.pattern as string).test(val as string);
          }
        )
      : schema
} as unknown as Constraint;

const numberConstraints = {
  required: (schema: Yup.NumberSchema, property: Property) =>
    property.required ? schema.required("This field is required") : schema.notRequired(),
  enum: (schema: Yup.NumberSchema, property: Property) =>
    Array.isArray(property.enum)
      ? schema.oneOf(property.enum, `Value must be one of: ${property.enum.join(", ")}`)
      : schema,
  minimum: (schema: Yup.NumberSchema, property: Property) =>
    property.minimum !== undefined && property.minimum !== null
      ? schema.min(property.minimum, `Value must be greater than ${property.minimum}`)
      : schema,
  maximum: (schema: Yup.NumberSchema, property: Property) =>
    property.maximum !== undefined && property.maximum !== null
      ? schema.max(property.maximum, `Value must be less than ${property.maximum}`)
      : schema
} as unknown as Constraint;

const dateConstraints = {
  required: (schema: Yup.DateSchema, property: Property) =>
    property.required ? schema.required("This field is required") : schema.notRequired()
} as unknown as Constraint;

const booleanConstraints = {
  required: (schema: Yup.BooleanSchema, property: Property) =>
    property.required ? schema.required("This field is required") : schema.notRequired()
} as unknown as Constraint;

const mixedConstraints = {
  required: (schema: Yup.Schema, property: Property) =>
    property.required ? schema.required("This field is required") : schema.notRequired()
} as unknown as Constraint;

const arrayConstraints = {
  required: (schema: Yup.ArraySchema<any, any>, property: Property) =>
    property.required
      ? schema.required("This field is required").min(1, "This field is required")
      : schema.notRequired(),

  minItems: (schema: Yup.ArraySchema<any, any>, property: Property) =>
    property.minItems != null
      ? (schema as Yup.ArraySchema<any, any>).min(
          property.minItems,
          `Array must contain at least ${property.minItems} item${property.minItems > 1 ? "s" : ""}`
        )
      : schema,

  maxItems: (schema: Yup.ArraySchema<any, any>, property: Property) =>
    property.maxItems != null
      ? (schema as Yup.ArraySchema<any, any>).max(
          property.maxItems,
          `Array must contain at most ${property.maxItems} item${property.maxItems > 1 ? "s" : ""}`
        )
      : schema
} as unknown as Constraint;

function applyConstraints<T extends Yup.AnySchema>(
  schema: T,
  property: Property,
  registry: Record<
    string,
    (
      schema: Yup.AnySchema,
      property: Omit<Property, "required"> & {required?: boolean}
    ) => Yup.AnySchema
  >,
  required?: boolean
): T {
  let current: Yup.AnySchema = schema;
  for (const key of Object.keys(registry)) {
    const fn = registry[key];
    if (fn) {
      current = fn(current, {...property, required}); // pass required separately to avoid modifying original property object
    }
  }
  return current as T;
}

const generateFieldValueSchema = (kind: FieldKind, property: Property, required?: boolean) => {
  switch (kind) {
    case FieldKind.String:
    case FieldKind.Textarea:
    case FieldKind.Richtext:
    case FieldKind.Color:
      return applyConstraints(Yup.string(), property, stringConstraints, required);

    case FieldKind.Number:
      return applyConstraints(
        Yup.number().typeError("Value must be a number"),
        property,
        numberConstraints,
        required
      );

    case FieldKind.Boolean:
      return applyConstraints(Yup.boolean(), property, booleanConstraints, required);

    case FieldKind.Date:
      return applyConstraints(
        Yup.mixed().test("invalid-date", "Please provide a valid date.", function (value) {
          const isInvalidDateString = (value as unknown as string) === "Invalid Date";
          const isInvalidDateObject = value instanceof Date && isNaN(value.getTime());
          const isUnparsableDateValue = isNaN(new Date(value as Date).getTime());
          return required && (isInvalidDateString || isInvalidDateObject || isUnparsableDateValue)
            ? false
            : true;
        }),
        property,
        dateConstraints,
        required
      );

    case FieldKind.Multiselect:
      return applyConstraints(Yup.array().of(Yup.mixed()), property, arrayConstraints, required);

    case FieldKind.Location:
      return applyConstraints(
        Yup.object({
          address: Yup.string().notRequired(),
          lat: Yup.number().notRequired(),
          lng: Yup.number().notRequired()
        }),
        property,
        mixedConstraints,
        required
      );

    case FieldKind.Array: {
      let arr = applyConstraints(
        Yup.array(),
        property,
        arrayConstraints,
        required
      ) as Yup.ArraySchema<any, any, any>;
      const itemType = property?.items?.type as FieldKind | undefined;
      const itemProps = property?.items;

      if (itemType && itemProps) {
        const baseItemSchema = generateFieldValueSchema(itemType, itemProps) as Yup.AnySchema;

        if (itemType === FieldKind.Object) {
          const enhancedObjectSchema = baseItemSchema
            .transform((_, originalValue) => originalValue)
            .test({
              name: "object-with-index",
              message: "Validation failed",
              test: function (value, context) {
                try {
                  baseItemSchema.validateSync(value, {abortEarly: false});
                  return true;
                } catch (error) {
                  if (error instanceof Yup.ValidationError) {
                    const firstError = error.inner[0] || error;
                    const fieldPath = firstError.path || "";

                    const idxMatch = (context.path || "").match(/\[(\d+)\]$/);
                    const index = idxMatch ? idxMatch[1] : undefined;
                    const arrayBase = (context.path || "").replace(/\[\d+\]$/, "");

                    const innerField = fieldPath || "";
                    const cleanedMsg = (firstError.message || "")
                      .replace(/^this field /i, "")
                      .replace(/^This field /i, "");
                    const message = innerField
                      ? `${innerField} at index ${index} ${cleanedMsg}`.trim()
                      : index
                        ? `${cleanedMsg} at index ${index}`.trim()
                        : `${cleanedMsg}`;

                    return context.createError({
                      path: arrayBase || context.path,
                      message
                    });
                  }
                  return false;
                }
              }
            });

          arr = arr.of(enhancedObjectSchema);
        } else {
          const enhancedPrimitiveSchema = baseItemSchema.test({
            name: "primitive-with-index",
            message: "Validation failed",
            test: function (value, context) {
              try {
                baseItemSchema.validateSync(value);
                return true;
              } catch (error) {
                if (error instanceof Yup.ValidationError) {
                  const idxMatch = (context.path || "").match(/\[(\d+)\]$/);
                  const index = idxMatch ? idxMatch[1] : undefined;
                  const arrayBase = (context.path || "").replace(/\[\d+\]$/, "");
                  const cleaned = (error.message || "")
                    .replace(/^Value /i, "")
                    .replace(/^This field /i, "");
                  const message = index ? `${cleaned} at index ${index}`.trim() : cleaned;
                  return context.createError({
                    path: arrayBase || context.path,
                    message
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
      const props: Record<string, Property> | undefined = property?.properties;
      let obj: Yup.ObjectSchema<Yup.Maybe<{}>, Yup.AnyObject, {}, ""> = Yup.object();
      if (props && typeof props === "object") {
        const requiredKeys = Array.isArray(property?.required)
          ? (property.required as string[])
          : [];
        const shape: Record<string, Yup.AnySchema> = {};
        for (const [k, childProp] of Object.entries(props)) {
          const childKind = childProp?.type as FieldKind | undefined;
          let childSchema: Yup.AnySchema;
          if (childKind) {
            childSchema = generateFieldValueSchema(childKind, childProp, requiredKeys.includes(k));
          } else {
            childSchema = Yup.mixed();
          }
          shape[k] = childSchema;
        }
        obj = obj.shape(shape);
      }
      if (required) {
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
      return applyConstraints(Yup.mixed(), property, mixedConstraints, required);

    case FieldKind.Json:
      return applyConstraints(Yup.mixed(), property, mixedConstraints, required);

    case FieldKind.Relation:
      return applyConstraints(Yup.mixed(), property, mixedConstraints, required);

    default:
      return Yup.mixed().notRequired();
  }
};

export const validateFieldValue = (
  value: any,
  kind: FieldKind,
  properties: Property,
  required?: boolean
): FormError => {
  const schema = generateFieldValueSchema(kind, properties, required);
  try {
    schema.validateSync(value, {abortEarly: false});
    return null;
  } catch (error) {
    if (!(error instanceof Yup.ValidationError) || !error.inner || !error.inner.length)
      return (error as {message?: string})?.message || "Validation failed";
    let out: FormError = {};

    const getNested = (root: Record<string, any> | string, path: string, message: string) => {
      const parts = path.match(/[^.\[\]]+/g) || [path];

      const hasArrayIndex = parts.some(part => /^\d+$/.test(part));

      if (hasArrayIndex) {
        root = message;
      } else {
        let cur = root;
        for (let i = 0; i < parts.length; i++) {
          const part = parts[i];
          const isLast = i === parts.length - 1;

          if (isLast) {
            if (cur == null || typeof cur !== "object") {
              cur = {};
            }
            cur[part] = message;
          } else {
            if (cur == null || typeof cur !== "object") {
              cur = {};
            }
            if (!cur[part]) {
              cur[part] = {};
            }
            cur = cur[part];
          }
        }
      }

      return root;
    };

    for (const e of error.inner) {
      if (e.path) {
        if (typeof out === "string") out = {};
        out = getNested(out as Record<string, any>, e.path, e.message);
      } else {
        out = typeof out === "string" ? out : e.message;
      }
    }
    return out ?? "Validation failed";
  }
};

function createNestedErrorObject(flatErrors: Record<string, string>) {
  const result: TypeInputRepresenterError | string | null = {};

  for (const [path, message] of Object.entries(flatErrors)) {
    const keys = path.split(".");
    let current = result;

    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!(key in current)) {
        current[key] = {};
      }
      current = current[key] as TypeInputRepresenterError;
    }

    const lastKey = keys[keys.length - 1];
    current[lastKey] = message;
  }

  return result;
}

export function runYupValidation(
  schema: ValidationSchema,
  form: FieldFormState
): TypeInputRepresenterError | null {
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

      return createNestedErrorObject(flatErrors);
    }
    return {__root: "Validation failed"};
  }
}
