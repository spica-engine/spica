import { useCallback, useEffect, useMemo, useState } from "react";
import type { TypeProperties, TypeRepresenterValue } from "oziko-ui-kit/dist/custom-hooks/useInputRepresenter";

interface EntityWithPolicies {
  _id?: string;
  policies?: string[];
  [key: string]: any;
}

interface UseEntityDrawerConfig<TEntity extends EntityWithPolicies> {
  isOpen: boolean;
  selectedEntity: TEntity | null;
  nameField: string;
  policyOptions: string[];
  createMutation: (arg: any) => { unwrap: () => Promise<TEntity> };
  updateMutation: (arg: any) => { unwrap: () => Promise<TEntity> };
  addPolicyMutation: (arg: any) => { unwrap: () => Promise<any> };
  removePolicyMutation: (arg: any) => { unwrap: () => Promise<any> };
  isCreating: boolean;
  isUpdating: boolean;
  onClose: () => void;
}

export function useEntityDrawer<TEntity extends EntityWithPolicies>({
  isOpen,
  selectedEntity,
  nameField,
  policyOptions,
  createMutation,
  updateMutation,
  addPolicyMutation,
  removePolicyMutation,
  isCreating,
  isUpdating,
  onClose,
}: UseEntityDrawerConfig<TEntity>) {
  const isEditMode = !!selectedEntity?._id;

  const [formValues, setFormValues] = useState<TypeRepresenterValue>({
    [nameField]: "",
    password: "",
    policies: [] as string[],
  });

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSavingPolicies, setIsSavingPolicies] = useState(false);
  const isSaving = isCreating || isUpdating || isSavingPolicies;

  useEffect(() => {
    if (isOpen) {
      if (selectedEntity) {
        setFormValues({
          [nameField]: selectedEntity[nameField] ?? "",
          password: "",
          policies: selectedEntity.policies ?? [],
        });
      } else {
        setFormValues({
          [nameField]: "",
          password: "",
          policies: [],
        });
      }
      setFormErrors({});
    }
  }, [isOpen, selectedEntity, nameField]);

  const properties: TypeProperties = useMemo(() => ({
    [nameField]: {
      type: "string",
      title: nameField.charAt(0).toUpperCase() + nameField.slice(1),
      placeholder: `Enter ${nameField} (min 3 characters)`,
    },
    password: {
      type: "string",
      title: isEditMode ? "Password (leave empty to keep current)" : "Password",
      placeholder: "Enter password (min 3 characters)",
    },
    policies: {
      type: "multiselect",
      title: "Policies",
      enum: policyOptions,
    },
  }), [nameField, isEditMode, policyOptions]);

  const handleChange = useCallback((newValues: TypeRepresenterValue) => {
    setFormValues((prev) => ({ ...prev, ...newValues }));
    setFormErrors({});
  }, []);

  const handleSave = useCallback(async () => {
    const errors: Record<string, string> = {};
    const nameValue = String(formValues[nameField] ?? "").trim();
    const password = String(formValues.password ?? "").trim();

    if (!nameValue || nameValue.length < 3) {
      errors[nameField] = `${nameField.charAt(0).toUpperCase() + nameField.slice(1)} must be at least 3 characters`;
    }
    if (!isEditMode && (!password || password.length < 3)) {
      errors.password = "Password must be at least 3 characters";
    }
    if (isEditMode && password && password.length < 3) {
      errors.password = "Password must be at least 3 characters";
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    try {
      const selectedPolicies = (formValues.policies as string[]) ?? [];

      if (isEditMode && selectedEntity?._id) {
        const body: Record<string, any> = { [nameField]: nameValue };
        if (password) body.password = password;
        await updateMutation({ id: selectedEntity._id, body }).unwrap();

        const existingPolicies = selectedEntity.policies ?? [];
        const toAdd = selectedPolicies.filter((p) => !existingPolicies.includes(p));
        const toRemove = existingPolicies.filter((p) => !selectedPolicies.includes(p));

        setIsSavingPolicies(true);
        await Promise.all([
          ...toAdd.map((policyId) => addPolicyMutation({ id: selectedEntity._id!, policyId }).unwrap()),
          ...toRemove.map((policyId) => removePolicyMutation({ id: selectedEntity._id!, policyId }).unwrap()),
        ]);
        setIsSavingPolicies(false);
      } else {
        const createBody: Record<string, any> = { [nameField]: nameValue, password };
        const created = await createMutation(createBody).unwrap();

        if (selectedPolicies.length > 0 && created._id) {
          setIsSavingPolicies(true);
          await Promise.all(
            selectedPolicies.map((policyId) => addPolicyMutation({ id: created._id!, policyId }).unwrap())
          );
          setIsSavingPolicies(false);
        }
      }
      onClose();
    } catch (error: any) {
      const message = error?.data?.message || `Failed to save. Please try again.`;
      alert(message);
    }
  }, [formValues, isEditMode, selectedEntity, nameField, createMutation, updateMutation, addPolicyMutation, removePolicyMutation, onClose]);

  return {
    isEditMode,
    isSaving,
    formValues,
    formErrors,
    properties,
    handleChange,
    handleSave,
  };
}
