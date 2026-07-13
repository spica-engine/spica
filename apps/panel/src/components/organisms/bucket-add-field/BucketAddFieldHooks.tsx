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

    // securityValues is not part of the field-kind defaults initForm merges over,
    // so re-apply it here to keep an edited field's saved ACL on the form.
    const newFormValues = {...base, type, securityValues: initialValues?.securityValues};
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
