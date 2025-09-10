import * as Yup from "yup";
import {presetProperties} from "./BucketAddFieldSchema";
import type {FormErrors, FormValues} from "./BucketAddFieldBusiness";

const PROPERTY_NAME_REGEX = /^(?!(_id)$)([a-z_0-9]*)+$/;

type BuildSchemaArgs = {
  schema: Record<string, any>;
  configurationInputProperties?: Record<string, any>;
  defaultInputProperty?: Record<string, any>;
  forbiddenFieldNames: string[];
};

const buildSectionShape = (sectionSchema?: Record<string, any>) => {
  if (!sectionSchema) return {};
  return Object.entries(sectionSchema).reduce<Record<string, Yup.Schema>>((acc, [key, item]) => {
    let base: Yup.Schema<any>;
    const title = item?.title || "Field";

    switch (item.type) {
      case "number":
        const minimum = item.minimum ?? 0;
        base = Yup.number()
          .typeError(`${title} must be a number`)
          .min(
            minimum,
            minimum === 0
              ? `${title} must be a positive number`
              : `${title} must be at least ${minimum}`
          );
        break;
      case "boolean":
        base = Yup.boolean();
        break;
      case "array":
        base = Yup.array();
        break;
      default:
        base = Yup.string();
    }

    if (item.required) base = (base as any).required(`${title} is required`);
    else base = base.notRequired();

    if (item.renderCondition) {
      const {field, equals} = item.renderCondition;
      base = base.when(field, {
        is: (val: any) => val === equals,
        then: s => s,
        otherwise: s => s.notRequired()
      });
    }

    acc[key] = base;
    return acc;
  }, {});
};

export const createBucketFieldValidationSchema = ({
  schema,
  configurationInputProperties,
  defaultInputProperty,
  forbiddenFieldNames
}: BuildSchemaArgs) => {
  const fieldValuesShape = buildSectionShape(schema);

  // Override / enforce title rules
  fieldValuesShape.title = Yup.string()
    .required("Name is required")
    .matches(
      PROPERTY_NAME_REGEX,
      "Name can only contain lowercase letters, numbers, and underscores. It cannot be '_id' or an empty string and must not include spaces."
    )
    .notOneOf(
      forbiddenFieldNames,
      value => `'${value}' is a reserved name and cannot be used. Please choose a different name.`
    );

  const presetShape = buildSectionShape(presetProperties);

  presetShape.enumeratedValues = Yup.array()
    .of(Yup.string().trim().min(1))
    .when(["makeEnumerated"], {
      is: (m: boolean) => m === true,
      then: s => s.min(1, "Field must have at least one value"),
      otherwise: s => s.notRequired()
    });

  presetShape.regularExpression = Yup.string().when(["definePattern"], {
    is: (d: boolean) => d === true,
    then: s => s.required("Pattern is required"),
    otherwise: s => s.notRequired()
  });

  const configurationShape = buildSectionShape(configurationInputProperties);
  const defaultShape = buildSectionShape(defaultInputProperty);

  return Yup.object({
    type: Yup.string().required(),
    fieldValues: Yup.object(fieldValuesShape),
    presetValues: Yup.object(presetShape),
    configurationValues: Yup.object(configurationShape),
    defaultValue: Yup.object(defaultShape),
    innerFields: Yup.array().notRequired()
  });
};

type ValidateArgs = {
  formValues: FormValues;
  validationSchema: Yup.ObjectSchema<any>;
  setFormErrors: (e: FormErrors) => void;
  setApiError: (e: any) => void;
};

export const validateBucketFieldForm = async ({
  formValues,
  validationSchema,
  setFormErrors,
  setApiError
}: ValidateArgs) => {
  setApiError(null);
  try {
    await validationSchema.validate(formValues, {abortEarly: false});

    const needsInner =
      (formValues.type === "object" ||
        (formValues.type === "array" && formValues.fieldValues.arrayType === "object")) &&
      !(formValues.innerFields && formValues.innerFields.length);

    if (needsInner) {
      setFormErrors({innerFields: "At least one inner field is required"});
      return false;
    }

    setFormErrors({});
    return true;
  } catch (err: any) {
    const collected: FormErrors = {};
    if (err.inner?.length) {
      err.inner.forEach((e: any) => {
        if (!e.path) return;
        const path = e.path.split(".");
        switch (path[0]) {
          case "fieldValues":
            collected.fieldValues = collected.fieldValues || {};
            collected.fieldValues[path[1]] = e.message;
            break;
          case "presetValues":
            collected.presetValues = collected.presetValues || {};
            collected.presetValues[path[1]] = e.message;
            break;
          case "configurationValues":
            collected.configurationValues = collected.configurationValues || {};
            collected.configurationValues[path[1]] = e.message;
            break;
          case "defaultValue":
            collected.defaultValue = collected.defaultValue || {};
            collected.defaultValue[path[1]] = e.message;
            break;
        }
      });
    }
    setFormErrors(collected);
    return false;
  }
};
