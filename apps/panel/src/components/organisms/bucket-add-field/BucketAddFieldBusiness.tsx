import {type FC, useMemo, useState, useCallback, useEffect, memo, useRef} from "react";
import {FIELD_REGISTRY} from "../../../domain/fields/registry";
import {useBucket} from "../../../contexts/BucketContext";
import BucketAddFieldView from "./BucketAddFieldView";
import {
  useBucketFieldPopups,
  type BucketFieldPopup
} from "../../../components/molecules/bucket-field-popup/BucketFieldPopupsContext";
import {FieldKind, type FieldDefinition, type FieldFormState} from "src/domain/fields/types";
import {addInnerField, removeInnerField, updateInnerField} from "src/domain/fields/inner-fields";
import {initForm} from "src/domain/fields";

function isObjectEffectivelyEmpty(obj: Object): boolean {
  if (obj === null || obj === undefined) return true;
  if (typeof obj !== "object") return obj === "" || obj === null;

  return Object.values(obj).every(value => isObjectEffectivelyEmpty(value));
}

export type BucketAddFieldBusinessProps = {
  onSuccess?: () => void;
  onSaveAndClose: (values: FieldFormState) => void | Promise<any>;
  className?: string;
  popupId?: string;
};

type TypePresetValues = {
  preset: string;
  makeEnumerated: boolean;
  enumeratedValues: string[];
  definePattern: boolean;
  regularExpression: string;
};

export type FormErrors = {
  fieldValues?: Record<string, string>;
  presetValues?: Record<string, string>;
  configurationValues?: Record<string, string>;
  defaultValue?: Record<string, string>;
  innerFields?: string;
};

function useFormState(
  field: FieldDefinition,
  type: FieldKind,
  isInner: boolean,
  initialValues?: FieldFormState
) {
  const [formValues, setFormValues] = useState<FieldFormState>(field.creationFormDefaultValues);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    if (!type) return;

    const base = initForm(type, initialValues);

    const newFormValues = {
      fieldValues: base.fieldValues,
      configurationValues: base.configurationValues,
      presetValues: base.presetValues as TypePresetValues,
      defaultValue: base.defaultValue,
      type,
      innerFields: base.innerFields
    };

    setFormValues(newFormValues);
    setFormErrors({});
    setIsInitialized(true);
  }, [type, initialValues, isInner, field]);

  return {
    formValues,
    setFormValues,
    formErrors,
    setFormErrors,
    isInitialized
  };
}

const BucketAddFieldBusiness: FC<BucketAddFieldBusinessProps> = ({
  onSuccess,
  onSaveAndClose,
  className,
  popupId
}) => {
  const {bucketFieldPopups} = useBucketFieldPopups();
  const {buckets, createBucketFieldError} = useBucket();

  const currentPopup = bucketFieldPopups.find(p => p.id === popupId) as BucketFieldPopup;
  const {fieldKind: fieldType, popupType, initialValues} = currentPopup;

  const fieldDefinition = FIELD_REGISTRY[fieldType as FieldKind] as FieldDefinition;
  const isInnerField = popupType !== "add-field";

  const {
    fieldValues: initialMainFormProperties,
    configurationValues: configurationProperties,
    defaultValue: defaultValueProperties,
    presetValues: presetProperties
  } = useMemo(
    () => fieldDefinition.buildCreationFormProperties(isInnerField, buckets),
    [fieldDefinition, isInnerField, buckets]
  );

  const [mainFormProperties, setMainFormProperties] = useState(initialMainFormProperties);

  useEffect(() => {
    setMainFormProperties(initialMainFormProperties);
  }, [initialMainFormProperties]);

  const {formValues, setFormValues, formErrors, setFormErrors, isInitialized} = useFormState(
    fieldDefinition,
    fieldType as FieldKind,
    isInnerField,
    initialValues
  );

  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState(createBucketFieldError);

  useEffect(() => {
    setApiError(createBucketFieldError);
  }, [createBucketFieldError]);

  const oldValues = useRef(formValues);
  useEffect(() => {
    if (!fieldType || !isInitialized) return;
    const newFormValues = fieldDefinition.applyPresetLogic?.(formValues, oldValues.current);
    setFormValues(newFormValues ?? formValues);
    oldValues.current = newFormValues ?? formValues;
  }, [
    fieldType,
    isInitialized,
    formValues.presetValues.preset,
    formValues.presetValues.makeEnumerated,
    formValues.presetValues.definePattern,
    formValues.fieldValues.arrayType
  ]);

  useEffect(() => {
    if (!fieldType || fieldType !== "multiselect" || !isInitialized) return;
    const {updatedForm, updatedFieldProperties} =
      fieldDefinition.applySelectionTypeLogic?.(formValues, mainFormProperties) ?? {};
    setFormValues(updatedForm ?? formValues);
    setMainFormProperties(updatedFieldProperties ?? mainFormProperties);
  }, [fieldType, isInitialized, formValues.fieldValues.multipleSelectionType]);

  const validateForm = useCallback(async () => {
    setApiError(null);
    if (!fieldType) return false;

    const errors = fieldDefinition.validateCreationForm({
      fieldValues: formValues.fieldValues,
      configurationValues: formValues.configurationValues,
      defaultValue: formValues.defaultValue,
      presetValues: formValues.presetValues,
      innerFields: formValues.innerFields,
      type: fieldType
    });

    if (errors) {
      setFormErrors(errors);
      return false;
    }

    setFormErrors({});
    return true;
  }, [formValues, fieldType, popupType]);

  const oldType = useRef(fieldType);
  useEffect(() => {
    if (!formErrors || isObjectEffectivelyEmpty(formErrors) || oldType.current !== fieldType) {
      oldType.current = fieldType;
      return;
    }
    validateForm();
  }, [validateForm, formValues]);

  const handleSaveAndClose = useCallback(async () => {
    const isValid = await validateForm();
    if (!isValid) return;

    setIsLoading(true);
    const result = await onSaveAndClose(formValues);
    setIsLoading(false);

    if (result) onSuccess?.();
  }, [formValues, onSaveAndClose, validateForm, onSuccess]);

  const handleCreateInnerField: (values: FieldFormState) => void | Promise<any> = useCallback(
    values => {
      const innerKind = values.type || FieldKind.String;
      setFormValues(prev => addInnerField(prev, innerKind as FieldKind, values));
    },
    []
  );

  const handleSaveInnerField = useCallback((values: FieldFormState) => {
    setFormValues(prev => updateInnerField(prev, values));
  }, []);

  const handleDeleteInnerField = useCallback((field: FieldFormState) => {
    if (!field.id) return;
    setFormValues(prev => removeInnerField(prev, field.id as string));
  }, []);

  const handleFormValueChange = (
    values: FieldFormState,
    formValuesAttribute: keyof FieldFormState
  ) =>
    setFormValues(prev => {
      return {...prev, [formValuesAttribute]: values};
    });

  return (
    <BucketAddFieldView
      // Display props
      className={className}
      // Form data
      formValues={formValues}
      formErrors={formErrors}
      error={(apiError || formErrors?.innerFields) ?? null}
      // Schema and configuration
      mainFormInputProperties={mainFormProperties}
      configurationInputProperties={configurationProperties}
      defaultInputProperty={defaultValueProperties}
      presetInputProperties={presetProperties}
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
      type={fieldType as FieldKind}
    />
  );
};

export default memo(BucketAddFieldBusiness);
