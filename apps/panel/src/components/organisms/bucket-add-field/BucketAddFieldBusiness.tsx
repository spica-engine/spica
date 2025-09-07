import {
  type FC,
  useMemo,
  useState,
  useCallback,
  useEffect,
  type CSSProperties,
  memo,
  useRef
} from "react";
import {type IconName, type TypeInputType} from "oziko-ui-kit";
import type {BucketType} from "src/services/bucketService";
import {getDefaultValues} from "./BucketAddFieldUtils";
import {regexPresets, enumerationPresets} from "./BucketAddFieldPresets";
import {
  configPropertiesMapping,
  createShema,
  defaultConfig,
  innerFieldConfigProperties,
  presetProperties
} from "./BucketAddFieldSchema";
import {useBucket} from "../../../contexts/BucketContext";
import BucketAddFieldView from "./BucketAddFieldView";

export type BucketAddFieldBusinessProps = {
  type: TypeInputType;
  onSuccess?: () => void;
  onSaveAndClose: (values: FormValues) => void | Promise<any>;
  bucket: BucketType;
  buckets: BucketType[];
  initialValues?: FormValues;
  className?: string;
  innerFieldStyles: CSSProperties;
  configurationMapping: typeof configPropertiesMapping | typeof innerFieldConfigProperties;
  iconName?: IconName;
  forbiddenFieldNames?: string[];
};

function isObjectEffectivelyEmpty(obj: Object): boolean {
  if (obj === null || obj === undefined) return true;
  if (typeof obj !== "object") return obj === "" || obj === null;

  return Object.values(obj).every(value => isObjectEffectivelyEmpty(value));
}

type TypePresetValues = {
  preset: string;
  makeEnumerated: boolean;
  enumeratedValues: string[];
  definePattern: boolean;
  regularExpression: string;
};

export type FormValues = {
  fieldValues: Record<string, any>;
  presetValues: TypePresetValues;
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

const DEFAULT_PRESET_VALUES: TypePresetValues = {
  preset: "",
  makeEnumerated: false,
  enumeratedValues: [],
  definePattern: false,
  regularExpression: ""
};

const DEFAULT_FORM_VALUES: FormValues = {
  fieldValues: {
    title: "New Inner Field",
    description: ""
  },
  configurationValues: {},
  presetValues: DEFAULT_PRESET_VALUES,
  defaultValue: {},
  type: "object"
};

const BucketAddFieldBusiness: FC<BucketAddFieldBusinessProps> = ({
  type,
  onSuccess,
  onSaveAndClose,
  bucket,
  buckets,
  initialValues,
  className,
  innerFieldStyles,
  configurationMapping = configPropertiesMapping,
  iconName,
  forbiddenFieldNames = []
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
        ...getDefaultValues(configurationMapping[type as keyof typeof configurationMapping] || {})
      }
    }));
  }, [type, initialValues?.configurationValues, innerFieldExists]);

  const configFields = useMemo(
    () => configurationMapping[type as keyof typeof configurationMapping],
    [type]
  );

  // Initialize form values when type changes
  useEffect(() => {
    setFormValues(prev => ({
      ...prev,
      fieldValues: {...defaultFieldValues},
      configurationValues: {...getDefaultValues(configFields, initialValues?.configurationValues)},
      defaultValue: {...getDefaultValues(defaultProperty, initialValues?.fieldValues)},
      presetValues: type === "string" ? DEFAULT_PRESET_VALUES : prev.presetValues,
      type,
      ...initialValues
    }));
    setFormErrors({});
    setApiError(null);
  }, [type]);

  // Handle preset logic for string types
  useEffect(() => {
    setFormValues(prev => ({
      ...prev,
      presetValues:
        formValues.fieldValues.arrayType !== "string" ? DEFAULT_PRESET_VALUES : prev.presetValues,
      ...initialValues
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
              preset: presetKey,
              enumeratedValues: enumValues as string[],
              regularExpression: "",
              makeEnumerated: true,
              definePattern: false
            }
          : presetKey in regexPresets
            ? {
                preset: presetKey,
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
      setFormValues(prev => ({
        ...prev,
        presetValues: {...prev.presetValues, enumeratedValues: [], preset: ""}
      }));
    }
  }, [type, formValues.presetValues.makeEnumerated, formValues.fieldValues.arrayType]);

  // Handle pattern toggle
  useEffect(() => {
    if (type !== "string" && formValues.fieldValues.arrayType !== "string") return;
    const presetKey = formValues.presetValues.preset;
    if (!presetKey) return;
    const definePattern = formValues.presetValues.definePattern;
    if (!definePattern && presetKey in regexPresets) {
      setFormValues(prev => ({
        ...prev,
        presetValues: {...prev.presetValues, regularExpression: "", preset: ""}
      }));
    }
  }, [type, formValues.presetValues.definePattern, formValues.fieldValues.arrayType]);

  // Form validation
  const validateForm = useCallback(() => {
    setApiError(null);
    const errors: FormErrors = {};
    const propertyNameRegex = /^(?!(_id)$)([a-z_0-9]*)+$/;

    const validateSingleSchemaItem = ({
      key,
      schemaItem,
      values,
      errorSection
    }: {
      key: string;
      schemaItem: Record<string, any>;
      values: Record<string, any>;
      errorSection: keyof FormErrors;
    }) => {
      const shouldRender =
        !schemaItem.renderCondition ||
        values[schemaItem.renderCondition.field] === schemaItem.renderCondition.equals;

      const addError = (message: string) => {
        if (!errors[errorSection]) {
          errors[errorSection] = {} as Record<string, string> & string;
        }
        (errors[errorSection] as Record<string, string>)[key] = message;
      };

      const fieldTitle = (schemaItem as {title: string})?.title ?? "Field";

      // Validate number fields
      if (
        values[key] !== undefined &&
        shouldRender &&
        schemaItem.type === "number" &&
        (isNaN(values[key]) || values[key] < schemaItem.min)
      ) {
        addError(`${fieldTitle} must be a positive number`);
        return;
      }

      // Validate required fields
      if (schemaItem.required && !values?.[key] && shouldRender) {
        addError(`${fieldTitle} is required`);
      }

      if (
        key === "enumeratedValues" &&
        shouldRender &&
        values.makeEnumerated &&
        (!values.enumeratedValues || values.enumeratedValues.length === 0)
      ) {
        addError(`Field must have at least one value`);
      }
    };

    Object.entries(schema).forEach(([key, schemaItem]) =>
      validateSingleSchemaItem({
        key,
        schemaItem,
        values: formValues.fieldValues,
        errorSection: "fieldValues"
      })
    );
    Object.entries(presetProperties).forEach(([key, value]) => {
      validateSingleSchemaItem({
        key,
        schemaItem: value,
        values: formValues.presetValues,
        errorSection: "presetValues"
      });
    });
    Object.entries(configFields || {}).forEach(([key, schemaItem]) => {
      validateSingleSchemaItem({
        key,
        schemaItem,
        values: formValues.configurationValues,
        errorSection: "configurationValues"
      });
    });
    Object.entries(defaultProperty || {}).forEach(([key, schemaItem]) => {
      validateSingleSchemaItem({
        key,
        schemaItem,
        values: formValues.defaultValue,
        errorSection: "defaultValue"
      });
    });

    if (
      !formValues.fieldValues?.title?.length ||
      !propertyNameRegex.test(formValues.fieldValues.title)
    ) {
      if (!errors.fieldValues) errors.fieldValues = {} as Record<string, string> & string;
      errors.fieldValues.title =
        "Name can only contain lowercase letters, numbers, and underscores. It cannot be '_id' or an empty string and must not include spaces.";
    }

    if (forbiddenFieldNames.includes(formValues.fieldValues.title)) {
      if (!errors.fieldValues) errors.fieldValues = {} as Record<string, string> & string;
      errors.fieldValues.title = `'${formValues.fieldValues.title}' is a reserved name and cannot be used. Please choose a different name.`;
    }

    if (
      (formValues.type === "object" ||
        (formValues.type === "array" && formValues.fieldValues.arrayType === "object")) &&
      !formValues.innerFields?.length
    ) {
      errors.innerFields = "At least one inner field is required";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [schema, formValues]);

  const oldType = useRef(type);
  useEffect(() => {
    if (!formErrors || isObjectEffectivelyEmpty(formErrors) || oldType.current !== type) {
      oldType.current = type;
      return;
    }
    validateForm();
  }, [formValues, validateForm]);

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
        innerFields: [...(prev.innerFields || []), {...values, id}]
      }));
    },
    []
  );

  const handleSaveInnerField = useCallback((values: FormValues) => {
    setFormValues(prev => ({
      ...prev,
      innerFields: prev.innerFields?.map((innerField: FormValues) =>
        innerField?.id === values.id ? values : innerField
      )
    }));
  }, []);

  const handleDeleteInnerField = useCallback((field: FormValues) => {
    setFormValues(prev => ({
      ...prev,
      innerFields: prev.innerFields?.filter((innerField: FormValues) => innerField.id !== field.id)
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
      iconName={iconName}
    />
  );
};

export default memo(BucketAddFieldBusiness);
