import {type FC, useMemo, useState, useCallback, useEffect, memo, useRef} from "react";
import {FIELD_REGISTRY} from "../../../domain/fields/registry";
import {useGetBucketsQuery, useCreateBucketFieldMutation} from "../../../store/api/bucketApi";
import BucketAddFieldView from "./BucketAddFieldView";
import type {PopupType} from "../../molecules/bucket-field-popup/BucketFieldConfigurationPopup";
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
import type {BucketType} from "src/store/api/bucketApi";

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
  fieldType?: FieldKind;
  popupType?: PopupType;
  initialValues?: FieldFormState;
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
  forbiddenFieldNames,
  fieldType,
  popupType = "add-field",
  initialValues
}) => {
  const {data: buckets = []} = useGetBucketsQuery();
  const [, { error: createBucketFieldError }] = useCreateBucketFieldMutation({
    fixedCacheKey: 'shared-create-bucket-field'
  });

  const fieldDefinition = fieldType ? FIELD_REGISTRY[fieldType as FieldKind] as FieldDefinition : null;
  const isInnerField = popupType !== "add-field";

  const {
    fieldValues: initialMainFormProperties,
    configurationValues: configurationProperties,
    defaultValue: defaultValueProperties,
    presetValues: presetProperties,
    multipleSelectionTab: multipleSelectionTabProperties
  } = useMemo(
    () => fieldDefinition?.buildCreationFormProperties(isInnerField, buckets) || {fieldValues: {}, configurationValues: {}, defaultValue: undefined, presetValues: undefined, multipleSelectionTab: undefined},
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

  // Helper to format error message
  const getErrorMessage = (error: any): string | null => {
    if (!error) return null;
    if (typeof error === 'string') return error;
    if (error.message) return error.message;
    if (error.data?.message) return error.data.message;
    return 'An error occurred';
  };

  const oldValues = useRef(formValues);
  useEffect(() => {
    if (!fieldType || !isInitialized || !fieldDefinition) return;
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
    if (fieldType !== "multiselect" || !isInitialized || !fieldDefinition) return;
    const {updatedForm, updatedFieldProperties} =
      fieldDefinition.applySelectionTypeLogic?.(formValues, mainFormProperties) ?? {};
    setFormValues(updatedForm ?? formValues);
    setMainFormProperties(updatedFieldProperties ?? mainFormProperties);
  }, [fieldType, isInitialized, formValues.multipleSelectionTab?.multipleSelectionType]);

  const validateForm = useCallback(async () => {
    // No need to manually clear API error since RTK Query handles it
    if (!fieldType || !fieldDefinition) return false;

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
  }, [formValues, fieldType, popupType, fieldDefinition]);

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
    setFormValues(prev => {
      const updated = updateInnerField(prev, values);
      return updated;
    });
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

  if (!fieldType || !fieldDefinition) {
    return null;
  }

  return (
    <BucketAddFieldView
      className={className}
      formValues={formValues}
      formErrors={formErrors}
      error={(getErrorMessage(createBucketFieldError) || formErrors?.innerFields) ?? null}
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
      popupType={popupType}
    />
  );
};

export default memo(BucketAddFieldBusiness);
