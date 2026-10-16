import { useCallback, useMemo, type Dispatch, type SetStateAction } from "react";
import type { TypeRepresenterValue } from "oziko-ui-kit/dist/custom-hooks/useInputRepresenter";
import { usePolicyOptions } from "./usePolicyOptions";

interface PolicyFormBindingsConfig {
  formValues: TypeRepresenterValue;
  setFormValues: Dispatch<SetStateAction<TypeRepresenterValue>>;
  setFormErrors: Dispatch<SetStateAction<Record<string, string>>>;
}

export function usePolicyFormBindings({
  formValues,
  setFormValues,
  setFormErrors,
}: PolicyFormBindingsConfig) {
  const { policyOptions, policyLabels, toInputValues, fromInputChange } = usePolicyOptions();

  const handleChange = useCallback(
    (newValues: TypeRepresenterValue) => {
      setFormValues((prev) => ({ ...prev, ...fromInputChange(newValues) }));
      setFormErrors({});
    },
    [fromInputChange, setFormValues, setFormErrors]
  );

  const inputValues = useMemo(() => toInputValues(formValues), [formValues, toInputValues]);

  const setAllPolicies = useCallback(
    (selectAll: boolean) => {
      setFormValues((prev) => ({ ...prev, policies: selectAll ? [...policyOptions] : [] }));
    },
    [policyOptions, setFormValues]
  );

  return { policyOptions, policyLabels, handleChange, inputValues, setAllPolicies };
}
