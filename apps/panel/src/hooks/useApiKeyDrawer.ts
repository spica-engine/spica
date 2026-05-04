import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  TypeProperties,
  TypeRepresenterValue,
} from "oziko-ui-kit/dist/custom-hooks/useInputRepresenter";
import {
  useCreateApiKeyMutation,
  useUpdateApiKeyMutation,
  useAddApiKeyPolicyMutation,
  useRemoveApiKeyPolicyMutation,
  type ApiKey,
} from "../store/api/apiKeyApi";
import { useGetPoliciesQuery } from "../store/api/policyApi";

interface UseApiKeyDrawerConfig {
  isOpen: boolean;
  selectedApiKey: ApiKey | null;
  onClose: () => void;
  onKeyCreated?: (key: string) => void;
}

export function useApiKeyDrawer({
  isOpen,
  selectedApiKey,
  onClose,
  onKeyCreated,
}: UseApiKeyDrawerConfig) {
  const [createApiKey, { isLoading: isCreating }] = useCreateApiKeyMutation();
  const [updateApiKey, { isLoading: isUpdating }] = useUpdateApiKeyMutation();
  const [addPolicy, { isLoading: isAddingPolicy }] = useAddApiKeyPolicyMutation();
  const [removePolicy, { isLoading: isRemovingPolicy }] = useRemoveApiKeyPolicyMutation();
  const { data: policies } = useGetPoliciesQuery();

  const isEditMode = !!selectedApiKey?._id;

  const [formValues, setFormValues] = useState<TypeRepresenterValue>({
    name: "",
    description: "",
    active: true,
    policies: [] as string[],
  });

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const isSaving = isCreating || isUpdating || isAddingPolicy || isRemovingPolicy;

  useEffect(() => {
    if (isOpen) {
      if (selectedApiKey) {
        setFormValues({
          name: selectedApiKey.name ?? "",
          description: selectedApiKey.description ?? "",
          active: selectedApiKey.active ?? true,
          policies: selectedApiKey.policies ?? [],
        });
      } else {
        setFormValues({
          name: "",
          description: "",
          active: true,
          policies: [],
        });
      }
      setFormErrors({});
    }
  }, [isOpen, selectedApiKey]);

  const policyOptions = useMemo(
    () => (policies ?? []).map((p) => p._id),
    [policies]
  );

  const properties: TypeProperties = useMemo(
    () => ({
      name: {
        type: "string",
        title: "Name",
        placeholder: "Enter API key name",
      },
      description: {
        type: "string",
        title: "Description",
        placeholder: "Enter description (optional)",
      },
      active: {
        type: "boolean",
        title: "Active",
      },
      policies: {
        type: "multiselect",
        title: "Policies",
        enum: policyOptions,
      },
    }),
    [policyOptions]
  );

  const handleChange = useCallback((newValues: TypeRepresenterValue) => {
    setFormValues((prev) => ({ ...prev, ...newValues }));
    setFormErrors({});
  }, []);

  const handleSave = useCallback(async () => {
    const name = String(formValues.name ?? "").trim();

    if (!name) {
      setFormErrors({ name: "Name is required" });
      return;
    }

    try {
      const selectedPolicies = (formValues.policies as string[]) ?? [];
      const body = {
        name,
        description: String(formValues.description ?? "").trim(),
        active: formValues.active as boolean,
      };

      if (isEditMode && selectedApiKey?._id) {
        await updateApiKey({ id: selectedApiKey._id, body }).unwrap();

        const currentPolicies = selectedApiKey.policies ?? [];
        const toAdd = selectedPolicies.filter((p) => !currentPolicies.includes(p));
        const toRemove = currentPolicies.filter((p) => !selectedPolicies.includes(p));

        await Promise.all([
          ...toAdd.map((policyId) =>
            addPolicy({ id: selectedApiKey._id!, policyId }).unwrap()
          ),
          ...toRemove.map((policyId) =>
            removePolicy({ id: selectedApiKey._id!, policyId }).unwrap()
          ),
        ]);
      } else {
        const created = await createApiKey(body).unwrap();

        if (selectedPolicies.length > 0 && created._id) {
          await Promise.all(
            selectedPolicies.map((policyId) =>
              addPolicy({ id: created._id!, policyId }).unwrap()
            )
          );
        }

        if (created.key) {
          onKeyCreated?.(created.key);
        }
      }

      onClose();
    } catch (error: any) {
      const message =
        error?.data?.message || "Failed to save. Please try again.";
      alert(message);
    }
  }, [
    formValues,
    isEditMode,
    selectedApiKey,
    createApiKey,
    updateApiKey,
    addPolicy,
    removePolicy,
    onClose,
    onKeyCreated,
  ]);

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
