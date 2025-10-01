import {type FC, useMemo, useState, useCallback, useEffect, memo, useRef} from "react";
import type {TypeInputType} from "oziko-ui-kit";
import * as fieldDomain from "../../../domain/fields";
import {resolveFieldKind} from "../../../domain/fields/registry"; // local helper for narrowing
// Direct import for base preset defaults (not re-exported intentionally)
import {BASE_PRESET_DEFAULTS} from "../../../domain/fields/defaults";
import {useBucket} from "../../../contexts/BucketContext";
import BucketAddFieldView from "./BucketAddFieldView";
import {
  useBucketFieldPopups,
  type BucketFieldPopup
} from "../../../components/molecules/bucket-field-popup/BucketFieldPopupsContext";
import type {FieldDefinition} from "src/domain/fields/types";

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
  defaultValue: any;
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

const BucketAddFieldBusiness: FC<BucketAddFieldBusinessProps> = ({
  onSuccess,
  onSaveAndClose,
  className,
  popupId
}) => {
  const {bucketFieldPopups, setBucketFieldPopups} = useBucketFieldPopups();
  const {
    fieldKind: type,
    popupType,
    initialValues
  } = bucketFieldPopups.find(p => p.id === popupId) as BucketFieldPopup;
  const field = fieldDomain.FIELD_REGISTRY[type as fieldDomain.FieldKind] as FieldDefinition;

  const isInner = popupType !== "add-field";

  // No direct registry usage needed here; facade supplies everything required.
  // Unified UI schema groups via facade
  // Buckets need to be resolved before schema memo to avoid temporal dead-zone issues
  const {createBucketFieldError, buckets, bucketData} = useBucket();
  const bucket = useMemo(
    () => buckets.find(i => i._id === bucketData?.bucketId),
    [buckets, bucketData?.bucketId]
  );
  const {
    fieldValues: mainFormInputProperties,
    configurationValues: configurationInputProperties,
    defaultValue: defaultInputProperty,
    presetValues: presetInputProperties
  } = useMemo(() => field.buildCreationFormProperties(), [field]);

  const [formValues, setFormValues] = useState<FormValues>(field.creationFormDefaultValues as any);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState(createBucketFieldError);

  useEffect(() => {
    setApiError(createBucketFieldError);
  }, [createBucketFieldError]);

  // Initialize form values when type changes
  useEffect(() => {
    if (!type) return;
    setFormValues(() => {
      const base = fieldDomain.initFormWithTitleFallback(type as fieldDomain.FieldKind, {
        inner: isInner,
        initial: initialValues
      });
      return {
        fieldValues: base.fieldValues,
        configurationValues: base.configurationValues,
        presetValues: base.presetValues as TypePresetValues,
        defaultValue: base.defaultValue,
        type: type as any,
        innerFields: base.innerFields
      };
    });
    setFormErrors({});
    setApiError(null);
  }, [type, initialValues, isInner]);

  const oldValues = useRef(formValues);
  useEffect(() => {
    if (!type) return;
    const newFormValues = field.applyPresetLogic?.(formValues, oldValues.current) as any;
    setFormValues(newFormValues ?? formValues);
    oldValues.current = newFormValues ?? formValues;
  }, [
    type,
    formValues.presetValues.preset,
    formValues.presetValues.makeEnumerated,
    formValues.presetValues.definePattern,
    formValues.fieldValues.arrayType
  ]);

  const validateForm = useCallback(async () => {
    setApiError(null);
    if (!type) return false;
    const errors = field.validateCreationForm({
      ...formValues.configurationValues,
      ...formValues.defaultValue,
      ...formValues.fieldValues,
      ...formValues.presetValues
    });
    if (errors) {
      setFormErrors(errors as any);
      return false;
    }
    setFormErrors({});
    return true;
  }, [formValues, type, popupType]);

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
      const innerKind = resolveFieldKind(values.type as any) || fieldDomain.FieldKind.String;
      setFormValues(
        prev =>
          fieldDomain.addInnerField(prev as any, innerKind as fieldDomain.FieldKind, {
            seed: values as any
          }) as any
      );
    },
    []
  );

  const handleSaveInnerField = useCallback((values: FormValues) => {
    setFormValues(prev => fieldDomain.updateInnerField(prev as any, values as any) as any);
  }, []);

  const handleDeleteInnerField = useCallback((field: FormValues) => {
    if (!field.id) return;
    setFormValues(prev => fieldDomain.removeInnerField(prev as any, field.id as string) as any);
  }, []);

  // We explicitly provide field values here because mainFormInputProperties can change
  // without formValues.fieldValues being updated. Without this, useInputRepresenter
  // may throw an error due to a mismatch between the provided values and the
  // expected property values. this can happen when switching between field types
  // Popup context mutation for forbidden names removed; computed locally instead.

  const handleFormValueChange = (values: FormValues, formValuesAttribute: keyof FormValues) =>
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
      mainFormInputProperties={mainFormInputProperties}
      configurationInputProperties={configurationInputProperties}
      defaultInputProperty={defaultInputProperty}
      presetInputProperties={presetInputProperties}
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
      type={type as fieldDomain.FieldKind}
    />
  );
};

export default memo(BucketAddFieldBusiness);
