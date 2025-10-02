import {initForm} from "../../../domain/fields";
import {FieldKind, type FieldDefinition, type FieldFormState} from "../../../domain/fields/types";
import {useState, useEffect} from "react";
import type {FormErrors} from "./BucketAddFieldBusiness";

export function useFormState(
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

    const newFormValues = {...base, type};
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
