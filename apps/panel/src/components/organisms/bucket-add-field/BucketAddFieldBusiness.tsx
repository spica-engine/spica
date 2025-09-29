import {type FC, useMemo, useState, useCallback, useEffect, memo, useRef} from "react";
import {FIELD_REGISTRY} from "../../../domain/fields/registry";
import {useBucket} from "../../../contexts/BucketContext";
import BucketAddFieldView from "./BucketAddFieldView";
import {
  useBucketFieldPopups,
  type BucketFieldPopup
} from "../../../components/molecules/bucket-field-popup/BucketFieldPopupsContext";
import {
  FieldKind,
  type FieldDefinition,
  type FieldFormState,
  type InnerFieldFormState
} from "../../../domain/fields/types";
import {
  addInnerField,
  removeInnerField,
  updateInnerField
} from "../../../domain/fields/inner-fields";
import {useFormState} from "./BucketAddFieldHooks";
import type {BucketType} from "src/services/bucketService";

function isObjectEffectivelyEmpty(obj: Object): boolean {
  if (obj === null || obj === undefined) return true;
  if (typeof obj !== "object") return obj === "" || obj === null;

  return Object.values(obj).every(value => isObjectEffectivelyEmpty(value));
}

export type BucketAddFieldBusinessProps = {
  onClose?: () => void;
  onSaveAndClose: (values: FieldFormState) => void | Promise<BucketType>;
  className?: string;
  popupId?: string;
  forbiddenFieldNames?: string[];
};

export type FormErrors = {
  fieldValues?: Record<string, string>;
  presetValues?: Record<string, string>;
  configurationValues?: Record<string, string>;
  defaultValue?: Record<string, string>;
  multipleSelectionTab?: Record<string, string>;
  innerFields?: string;
};

const BucketAddFieldBusiness: FC<BucketAddFieldBusinessProps> = ({
  onClose,
  onSaveAndClose,
  className,
  popupId,
  forbiddenFieldNames
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
    presetValues: presetProperties,
    multipleSelectionTab: multipleSelectionTabProperties
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

  useEffect(() => {
    setApiError(null);
  }, []);

  const oldValues = useRef(formValues);
  useEffect(() => {
    if (!fieldType || !isInitialized) return;
    const newFormValues = fieldDefinition.applyPresetLogic?.(formValues, oldValues.current);
    setFormValues(newFormValues ?? formValues);
    oldValues.current = newFormValues ?? formValues;
  }, [
    fieldType,
    isInitialized,
    formValues.presetValues?.preset,
    formValues.presetValues?.makeEnumerated,
    formValues.presetValues?.definePattern,
    formValues.fieldValues?.arrayType
  ]);

  useEffect(() => {
    if (fieldType !== "multiselect" || !isInitialized) return;
    const {updatedForm, updatedFieldProperties} =
      fieldDefinition.applySelectionTypeLogic?.(formValues, mainFormProperties) ?? {};
    setFormValues(updatedForm ?? formValues);
    setMainFormProperties(updatedFieldProperties ?? mainFormProperties);
  }, [fieldType, isInitialized, formValues.multipleSelectionTab?.multipleSelectionType]);

  const validateForm = useCallback(async () => {
    setApiError(null);
    if (!fieldType) return false;

    const errors = fieldDefinition.validateCreationForm({...formValues, type: fieldType});

    if (errors) {
      setFormErrors(errors);
      return false;
    }

    if (forbiddenFieldNames?.includes(formValues.fieldValues.title)) {
      setFormErrors(prev => ({
        ...prev,
        fieldValues: {title: "This title is already taken."}
      }));
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

    if (result) onClose?.();
  }, [formValues, onSaveAndClose, validateForm, onClose]);

  const handleCreateInnerField = useCallback((values: FieldFormState) => {
    const innerKind = values.type || FieldKind.String;
    setFormValues(prev => addInnerField(prev, innerKind as FieldKind, values));
  }, []);

  const handleSaveInnerField = useCallback((values: InnerFieldFormState) => {
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
      className={className}
      formValues={formValues}
      formErrors={formErrors}
      error={(apiError || formErrors?.innerFields) ?? null}
      mainFormInputProperties={mainFormProperties}
      configurationInputProperties={configurationProperties}
      defaultInputProperty={defaultValueProperties}
      presetInputProperties={presetProperties}
      multipleSelectionTabProperties={multipleSelectionTabProperties}
      isLoading={isLoading}
      handleFormValueChange={handleFormValueChange}
      handleSaveAndClose={handleSaveAndClose}
      handleCreateInnerField={handleCreateInnerField}
      handleSaveInnerField={handleSaveInnerField}
      handleDeleteInnerField={handleDeleteInnerField}
      popupId={popupId}
      type={fieldType as FieldKind}
    />
  );
};

export default memo(BucketAddFieldBusiness);
