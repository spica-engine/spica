import {type FC, useMemo, useState, useCallback, useEffect, memo, useRef} from "react";
import type {TypeInputType} from "oziko-ui-kit";
import {getDefaultValues} from "./BucketAddFieldUtils";
import {regexPresets, enumerationPresets} from "./BucketAddFieldPresets";
import {
  configPropertiesMapping,
  createShema,
  defaultConfig,
  innerFieldConfigProperties
} from "./BucketAddFieldSchema";
import {useBucket} from "../../../contexts/BucketContext";
import BucketAddFieldView from "./BucketAddFieldView";
import {
  createBucketFieldValidationSchema,
  validateBucketFieldForm
} from "./BucketAddFieldValidation";
import {
  useBucketFieldPopups,
  type BucketFieldPopup
} from "../../../components/molecules/bucket-field-popup/BucketFieldPopupsContext";

function hasSameElements(a: string[], b: string[]) {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((val, i) => val === sortedB[i]);
}

export type BucketAddFieldBusinessProps = {
  onSuccess?: () => void;
  onSaveAndClose: (values: FormValues) => void | Promise<any>;
  className?: string;
  popupId?: string;
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
  onSuccess,
  onSaveAndClose,
  className,
  popupId
}) => {
  const {bucketFieldPopups, setBucketFieldPopups} = useBucketFieldPopups();
  const {
    fieldType: type,
    forbiddenFieldNames,
    popupType,
    initialValues
  } = bucketFieldPopups.find(p => p.id === popupId) as BucketFieldPopup;

  const configurationMapping =
    popupType === "add-field" ? configPropertiesMapping : innerFieldConfigProperties;

  // Schema and form state management
  const schema = useMemo(() => createShema[type as keyof typeof createShema] || {}, [type]);
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

  const {createBucketFieldError, buckets, bucketData} = useBucket();

  const bucket = useMemo(
    () => buckets.find(i => i._id === bucketData?.bucketId),
    [buckets, bucketData?.bucketId]
  );
  const existingFieldNames = useMemo(() => Object.keys(bucket?.properties || {}), [bucket]);

  const [apiError, setApiError] = useState(createBucketFieldError);

  useEffect(() => {
    setApiError(createBucketFieldError);
  }, [createBucketFieldError]);

  const defaultInputProperty = useMemo(
    () => defaultConfig[type as keyof typeof defaultConfig] || {},
    [type]
  );

  const mainFormInputProperties = useMemo(
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
  }, [type, initialValues?.configurationValues, formValues.fieldValues.arrayType]);

  const configurationInputProperties = useMemo(
    () => configurationMapping[type as keyof typeof configurationMapping],
    [type]
  );

  // Initialize form values when type changes
  useEffect(() => {
    setFormValues(prev => ({
      ...prev,
      fieldValues: {...defaultFieldValues},
      configurationValues: {
        ...getDefaultValues(configurationInputProperties, initialValues?.configurationValues)
      },
      defaultValue: {...getDefaultValues(defaultInputProperty, initialValues?.fieldValues)},
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

  const validationSchema = useMemo(
    () =>
      createBucketFieldValidationSchema({
        schema,
        configurationInputProperties,
        defaultInputProperty,
        forbiddenFieldNames: forbiddenFieldNames || []
      }),
    [schema, configurationInputProperties, defaultInputProperty, forbiddenFieldNames]
  );

  const validateForm = useCallback(
    () =>
      validateBucketFieldForm({
        formValues,
        validationSchema,
        setFormErrors,
        setApiError
      }),
    [formValues, validationSchema]
  );

  const oldType = useRef(type);
  useEffect(() => {
    if (!formErrors || isObjectEffectivelyEmpty(formErrors) || oldType.current !== type) {
      oldType.current = type;
      return;
    }
    validateForm();
  }, [formValues, validateForm, type, formErrors]);

  // Event handlers
  const handleSaveAndClose = useCallback(async () => {
    const isValid = await validateForm();
    if (!isValid) return;
    setIsLoading(true);
    const result = await onSaveAndClose(formValues);
    setIsLoading(false);
    if (result) onSuccess?.();
  }, [formValues, onSaveAndClose, validateForm, onSuccess]);

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

  // We explicitly provide field values here because mainFormInputProperties can change
  // without formValues.fieldValues being updated. Without this, useInputRepresenter
  // may throw an error due to a mismatch between the provided values and the
  // expected property values. this can happen when switching between field types
  const currentFormValues = useMemo(
    () =>
      hasSameElements(
        Object.keys(formValues.fieldValues).filter(i => i !== "innerFields"),
        Object.keys(defaultFieldValues)
      )
        ? formValues
        : {...formValues, fieldValues: defaultFieldValues},
    [formValues, defaultFieldValues]
  );

  const forbiddenInnerFieldNames = useMemo(
    () => currentFormValues.innerFields?.map((f: FormValues) => f.fieldValues.title) || [],
    [currentFormValues.innerFields]
  );

  useEffect(() => {
    if (!popupId) return;
    setBucketFieldPopups(prev => {
      const popupIndex = prev.findIndex(p => p.id === popupId);
      if (popupIndex === -1) return prev;
      const updatedPopup = {
        ...prev[popupIndex],
        forbiddenFieldNames:
          popupType === "add-field" ? existingFieldNames : forbiddenInnerFieldNames
      };
      const newPopups = [...prev];
      newPopups[popupIndex] = updatedPopup;
      return newPopups;
    });
  }, [forbiddenInnerFieldNames, existingFieldNames, popupType]);

  const handleFormValueChange = (values: FormValues, formValuesAttribute: keyof FormValues) =>
    setFormValues(prev => {
      return {...prev, [formValuesAttribute]: values};
    });

  return (
    <BucketAddFieldView
      // Display props
      className={className}
      // Form data
      formValues={currentFormValues}
      formErrors={formErrors}
      error={(apiError || formErrors?.innerFields) ?? null}
      // Schema and configuration
      mainFormInputProperties={mainFormInputProperties}
      configurationInputProperties={configurationInputProperties}
      defaultInputProperty={defaultInputProperty}
      // State
      isLoading={isLoading}
      // Event handlers
      handleFormValueChange={handleFormValueChange}
      handleSaveAndClose={handleSaveAndClose}
      handleCreateInnerField={handleCreateInnerField}
      handleSaveInnerField={handleSaveInnerField}
      handleDeleteInnerField={handleDeleteInnerField}
      // External dependencies
      popupId={popupId}
    />
  );
};

export default memo(BucketAddFieldBusiness);
