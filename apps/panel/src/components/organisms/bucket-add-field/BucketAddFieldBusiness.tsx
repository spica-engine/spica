import {type FC, useMemo, useState, useCallback, useEffect, type CSSProperties, memo} from "react";
import {type TypeInputType} from "oziko-ui-kit";
import type {BucketType} from "src/services/bucketService";
import {getDefaultValues} from "./BucketAddFieldUtils";
import {regexPresets, enumerationPresets} from "./BucketAddFieldPresets";
import {
  createShema,
  configPropertiesMapping,
  defaultConfig,
  presetProperties
} from "./BucketAddFieldSchema";
import {useBucket} from "../../../contexts/BucketContext";
import BucketAddFieldView from "./BucketAddFieldView";
import {DEFAULT_FORM_VALUES} from "./BucketAddField";

export type BucketAddFieldBusinessProps = {
  type: TypeInputType;
  onSuccess?: () => void;
  onSaveAndClose: (values: FormValues) => void | Promise<any>;
  bucket: BucketType;
  buckets: BucketType[];
  initialValues?: FormValues;
  className?: string;
  innerFieldStyles: CSSProperties;
};

export type FormValues = {
  fieldValues: Record<string, any>;
  presetValues: Record<string, any>;
  configurationValues: Record<string, any>;
  defaultValue: Record<string, any>;
  type: TypeInputType;
  innerFields?: FormValues[];
  id?: string;
};

export type FormErrors = {
  fieldValues?: Record<string, string>;
  presetValues?: Record<string, string>;
  configurationValues?: Record<string, string>;
  defaultValue?: Record<string, string>;
  innerFields?: string;
};

const DEFAULT_PRESET_VALUES = {
  preset: "",
  makeEnumerated: false,
  enumeratedValues: [],
  definePattern: false,
  regularExpression: ""
};

const BucketAddFieldBusiness: FC<BucketAddFieldBusinessProps> = ({
  type,
  onSuccess,
  onSaveAndClose,
  bucket,
  buckets,
  initialValues,
  className,
  innerFieldStyles
}) => {
  // Schema and form state management
  const schema = useMemo(() => createShema[type] || {}, [type]);
  const defaultFieldValues = useMemo(
    () =>
      initialValues?.fieldValues ??
      getDefaultValues(schema, {
        title: "Name",
        description: ""
      }),
    [type, schema, initialValues?.fieldValues]
  );
  const [formValues, setFormValues] = useState<FormValues>(DEFAULT_FORM_VALUES);

  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [isLoading, setIsLoading] = useState(false);

  const {createBucketFieldError} = useBucket();
  const [apiError, setApiError] = useState(createBucketFieldError);

  useEffect(() => {
    setApiError(createBucketFieldError);
  }, [createBucketFieldError]);

  // Computed properties
  const innerFieldExists = useMemo(
    () => (type === "array" && formValues.fieldValues.arrayType === "object") || type === "object",
    [type, formValues.fieldValues.arrayType]
  );

  const defaultProperty = useMemo(
    () => defaultConfig[type as keyof typeof defaultConfig] || {},
    [type]
  );

  const inputProperties = useMemo(
    () => ({
      ...schema,
      ...(type === "relation" && {
        bucket: {
          ...schema.bucket,
          enum: buckets.map(b => ({label: b.title, value: b._id}))
        }
      })
    }),
    [type, schema, buckets]
  );

  useEffect(() => {
    setFormValues(prev => ({
      ...prev,
      configurationValues: {
        ...prev.configurationValues,
        ...getDefaultValues(configPropertiesMapping[type] || {}, initialValues?.configurationValues)
      }
    }));
  }, [type, initialValues?.configurationValues, innerFieldExists]);

  const configFields = useMemo(() => configPropertiesMapping[type], [type]);

  // Initialize form values when type changes
  useEffect(() => {
    setFormValues(prev => ({
      ...prev,
      fieldValues: {...defaultFieldValues},
      configurationValues: {...getDefaultValues(configFields, initialValues?.configurationValues)},
      defaultValue: {...getDefaultValues(defaultProperty, initialValues?.fieldValues)},
      presetValues: type === "string" ? DEFAULT_PRESET_VALUES : prev.presetValues,
      type
    }));
    setFormErrors({});
    setApiError(null);
  }, [type]);

  // Handle preset logic for string types
  useEffect(() => {
    setFormValues(prev => ({
      ...prev,
      presetValues:
        formValues.fieldValues.arrayType !== "string" ? DEFAULT_PRESET_VALUES : prev.presetValues
    }));

    if (formValues.fieldValues.multipleSelectionType) {
      schema.chip.multipleSelectionType = formValues.fieldValues.multipleSelectionType;
    }
  }, [formValues.fieldValues.arrayType, formValues.fieldValues.multipleSelectionType]);

  // Handle preset changes
  useEffect(() => {
    if (
      (type !== "string" && formValues.fieldValues.arrayType !== "string") ||
      !formValues.presetValues.preset
    )
      return;
    const presetKey = formValues.presetValues.preset;
    const enumValues = enumerationPresets[presetKey as keyof typeof enumerationPresets];
    const regexValue = regexPresets[presetKey as keyof typeof regexPresets];
    setFormValues(prev => ({
      ...prev,
      presetValues:
        presetKey in enumerationPresets
          ? {
              enumeratedValues: enumValues as never[],
              regularExpression: "",
              makeEnumerated: true,
              definePattern: false
            }
          : presetKey in regexPresets
            ? {
                ...prev,
                enumeratedValues: [],
                regularExpression: regexValue,
                makeEnumerated: false,
                definePattern: true
              }
            : prev.presetValues
    }));
  }, [type, formValues.presetValues.preset, formValues.fieldValues.arrayType]);

  // Handle enumeration toggle
  useEffect(() => {
    if (type !== "string" && formValues.fieldValues.arrayType !== "string") return;
    const presetKey = formValues.presetValues.preset;
    if (!presetKey) return;
    const makeEnumerated = formValues.presetValues.makeEnumerated;
    if (!makeEnumerated && presetKey in enumerationPresets) {
      setFormValues(prev => ({...prev, presetValues: {enumeratedValues: [], preset: ""}}));
    }
  }, [type, formValues.presetValues.makeEnumerated, formValues.fieldValues.arrayType]);

  // Handle pattern toggle
  useEffect(() => {
    if (type !== "string" && formValues.fieldValues.arrayType !== "string") return;
    const presetKey = formValues.presetValues.preset;
    if (!presetKey) return;
    const definePattern = formValues.presetValues.definePattern;
    if (!definePattern && presetKey in regexPresets) {
      setFormValues(prev => ({...prev, presetValues: {regularExpression: "", preset: ""}}));
    }
  }, [type, formValues.presetValues.definePattern, formValues.fieldValues.arrayType]);

  // Form validation
  const validateForm = useCallback(() => {
    setApiError(null);
    const errors: Record<string, string> = {};
    const propertyNameRegex = /^(?!(_id)$)([a-z_0-9]*)+$/;

    const validateSingleSchemaItem = ({
      key,
      schemaItem,
      values
    }: {
      key: string;
      schemaItem: any;
      values: Record<string, any>;
    }) => {
      if (schemaItem.type === "number" && (isNaN(values[key]) || values[key] < schemaItem.min)) {
        errors[key] =
          `${(schemaItem as {title: string})?.title ?? "Field"} must be a positive number`;
      }
      if (
        schemaItem.required &&
        !values.fieldValues?.[key] &&
        (!schemaItem.renderCondition ||
          values[schemaItem.renderCondition.field] === schemaItem.renderCondition.equals)
      ) {
        errors[key] = `${(schemaItem as {title: string})?.title ?? "Field"} is required`;
      }
    };

    Object.entries(schema).forEach(([key, schemaItem]) =>
      validateSingleSchemaItem({key, schemaItem, values: formValues.fieldValues})
    );
    Object.entries(presetProperties).forEach(([key, value]) => {
      validateSingleSchemaItem({key, schemaItem: value, values: formValues.presetValues});
    });
    Object.entries(configFields || {}).forEach(([key, schemaItem]) => {
      validateSingleSchemaItem({key, schemaItem, values: formValues.configurationValues});
    });
    Object.entries(defaultProperty || {}).forEach(([key, schemaItem]) => {
      validateSingleSchemaItem({key, schemaItem, values: formValues.defaultValue});
    });

    if (
      !formValues.fieldValues.title.length ||
      !propertyNameRegex.test(formValues.fieldValues.title)
    ) {
      errors.title =
        "Name can only contain lowercase letters, numbers, and underscores. It cannot be '_id' or an empty string and must not include spaces.";
    }

    if (
      (formValues.type === "object" ||
        (formValues.type === "array" && formValues.fieldValues.arrayType === "object")) &&
      !formValues.fieldValues.innerFields?.length
    ) {
      errors.innerFields = "At least one inner field is required";
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [schema, formValues.fieldValues, formValues.type]);

  // Event handlers
  const handleSaveAndClose = useCallback(async () => {
    const isValid = validateForm();
    if (!isValid) return;
    setIsLoading(true);

    const result = await onSaveAndClose(formValues);
    setIsLoading(false);
    if (result) onSuccess?.();
  }, [formValues, onSaveAndClose]);

  const handleCreateInnerField: (values: FormValues) => void | Promise<any> = useCallback(
    values => {
      const id = crypto.randomUUID();
      setFormValues(prev => ({
        ...prev,
        fieldValues: {
          ...prev.fieldValues,
          innerFields: [...(prev.fieldValues.innerFields || []), {...values, id}]
        }
      }));
    },
    []
  );

  const handleSaveInnerField = useCallback((values: FormValues) => {
    setFormValues(prev => ({
      ...prev,
      innerFields: prev.innerFields
        ? {
            ...prev.innerFields,
            innerFields: prev.innerFields?.map((innerField: FormValues) =>
              innerField?.id === values.id ? values : innerField
            )
          }
        : undefined
    }));
  }, []);

  const handleDeleteInnerField = useCallback((field: FormValues) => {
    setFormValues(prev => ({
      ...prev,
      innerFields: prev.innerFields
        ? {
            ...prev.innerFields,
            innerFields: prev.innerFields?.filter(
              (innerField: FormValues) => innerField.id !== field.id
            )
          }
        : undefined
    }));
  }, []);

  // Helper function for field values comparison
  function arraysEqualIgnoreOrder(a: string[], b: string[]) {
    if (a.length !== b.length) return false;
    const sortedA = [...a].sort();
    const sortedB = [...b].sort();
    return sortedA.every((val, i) => val === sortedB[i]);
  }

  // We explicitly provide field values here because inputProperties can change
  // without formValues.fieldValues being updated. Without this, useInputRepresenter
  // may throw an error due to a mismatch between the provided values and the
  // expected property values. this can happen when switching between field types
  const currentFormValues = useMemo(
    () =>
      arraysEqualIgnoreOrder(
        Object.keys(formValues.fieldValues).filter(i => i !== "innerFields"),
        Object.keys(defaultFieldValues)
      )
        ? formValues
        : {...formValues, fieldValues: defaultFieldValues},
    [formValues, defaultFieldValues]
  );

  return (
    <BucketAddFieldView
      // Display props
      className={className}
      innerFieldStyles={innerFieldStyles}
      // Form data
      formValues={currentFormValues}
      formErrors={formErrors}
      error={(apiError || formErrors?.innerFields) ?? null}
      // Schema and configuration
      inputProperties={inputProperties}
      configFields={configFields}
      defaultProperty={defaultProperty}
      // State
      isLoading={isLoading}
      innerFieldExists={innerFieldExists}
      // Event handlers
      setFormValues={setFormValues}
      handleSaveAndClose={handleSaveAndClose}
      handleCreateInnerField={handleCreateInnerField}
      handleSaveInnerField={handleSaveInnerField}
      handleDeleteInnerField={handleDeleteInnerField}
      // External dependencies
      bucket={bucket}
      buckets={buckets}
    />
  );
};

export default memo(BucketAddFieldBusiness);
