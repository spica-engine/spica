import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Button,
  Drawer,
  FlexElement,
  Icon,
  Text,
  useInputRepresenter,
} from "oziko-ui-kit";
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
} from "../../store/api/apiKeyApi";
import { useGetPoliciesQuery } from "../../store/api/policyApi";
import styles from "./ApiKey.module.scss";
import sharedStyles from "../shared/EntityPage.module.scss";

type ApiKeyDrawerProps = {
  isOpen: boolean;
  selectedApiKey: ApiKey | null;
  onClose: () => void;
  onKeyCreated?: (key: string) => void;
};

const ApiKeyDrawer: React.FC<ApiKeyDrawerProps> = ({
  isOpen,
  selectedApiKey,
  onClose,
  onKeyCreated,
}) => {
  const [createApiKey, { isLoading: isCreating }] = useCreateApiKeyMutation();
  const [updateApiKey, { isLoading: isUpdating }] = useUpdateApiKeyMutation();
  const [addPolicy] = useAddApiKeyPolicyMutation();
  const [removePolicy] = useRemoveApiKeyPolicyMutation();
  const { data: policies } = useGetPoliciesQuery();

  const isEditMode = !!selectedApiKey?._id;

  const [formValues, setFormValues] = useState<TypeRepresenterValue>({
    name: "",
    description: "",
    active: true,
    policies: [] as string[],
  });

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSavingPolicies, setIsSavingPolicies] = useState(false);
  const isSaving = isCreating || isUpdating || isSavingPolicies;

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
    const errors: Record<string, string> = {};
    const name = String(formValues.name ?? "").trim();

    if (!name || name.length < 1) {
      errors.name = "Name is required";
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    try {
      const selectedPolicies = (formValues.policies as string[]) ?? [];

      if (isEditMode && selectedApiKey?._id) {
        await updateApiKey({
          id: selectedApiKey._id,
          body: {
            name,
            description: String(formValues.description ?? "").trim(),
            active: formValues.active as boolean,
          },
        }).unwrap();

        const existingPolicies = selectedApiKey.policies ?? [];
        const toAdd = selectedPolicies.filter(
          (p) => !existingPolicies.includes(p)
        );
        const toRemove = existingPolicies.filter(
          (p) => !selectedPolicies.includes(p)
        );

        if (toAdd.length > 0 || toRemove.length > 0) {
          setIsSavingPolicies(true);
          try {
            await Promise.all([
              ...toAdd.map((policyId) =>
                addPolicy({ id: selectedApiKey._id!, policyId }).unwrap()
              ),
              ...toRemove.map((policyId) =>
                removePolicy({ id: selectedApiKey._id!, policyId }).unwrap()
              ),
            ]);
          } finally {
            setIsSavingPolicies(false);
          }
        }
      } else {
        const created = await createApiKey({
          name,
          description: String(formValues.description ?? "").trim(),
          active: formValues.active as boolean,
        }).unwrap();

        if (selectedPolicies.length > 0 && created._id) {
          setIsSavingPolicies(true);
          try {
            await Promise.all(
              selectedPolicies.map((policyId) =>
                addPolicy({ id: created._id!, policyId }).unwrap()
              )
            );
          } finally {
            setIsSavingPolicies(false);
          }
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

  const fields = useInputRepresenter({
    properties,
    value: formValues,
    onChange: handleChange,
    error: formErrors,
    errorClassName: sharedStyles.error,
    containerClassName: sharedStyles.inputFieldContainer,
  });

  return (
    <Drawer
      placement="right"
      size={600}
      isOpen={isOpen}
      onClose={onClose}
      showCloseButton={false}
    >
      <FlexElement
        dimensionX="fill"
        dimensionY="fill"
        direction="vertical"
        gap={0}
        alignment="leftTop"
        className={sharedStyles.drawerContainer}
      >
        <FlexElement
          dimensionX="fill"
          alignment="leftTop"
          className={sharedStyles.drawerTitle}
        >
          <Text size="large">
            {isEditMode ? "Edit API Key" : "New API Key"}
          </Text>
        </FlexElement>

        <FlexElement
          dimensionX="fill"
          dimensionY="fill"
          direction="vertical"
          alignment="leftTop"
          gap={16}
          className={sharedStyles.fieldContainer}
        >
          {fields}
        </FlexElement>

        <FlexElement
          dimensionX="fill"
          direction="horizontal"
          gap={10}
          alignment="rightCenter"
          className={sharedStyles.drawerFooter}
        >
          <Button
            variant="outlined"
            color="default"
            onClick={onClose}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} loading={isSaving}>
            Save
          </Button>
        </FlexElement>
      </FlexElement>
    </Drawer>
  );
};

export default ApiKeyDrawer;
