import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Drawer, FlexElement, Text, useInputRepresenter } from "oziko-ui-kit";
import type { TypeProperties, TypeRepresenterValue } from "oziko-ui-kit/dist/custom-hooks/useInputRepresenter";
import {
  useCreateIdentityMutation,
  useUpdateIdentityMutation,
  useAddIdentityPolicyMutation,
  useRemoveIdentityPolicyMutation,
  type Identity,
} from "../../store/api/identityApi";
import { useGetPoliciesQuery } from "../../store/api/policyApi";
import styles from "./Identity.module.scss";

type IdentityDrawerProps = {
  isOpen: boolean;
  selectedIdentity: Identity | null;
  onClose: () => void;
};

const IdentityDrawer: React.FC<IdentityDrawerProps> = ({ isOpen, selectedIdentity, onClose }) => {
  const { data: policies } = useGetPoliciesQuery();
  const [createIdentity, { isLoading: isCreating }] = useCreateIdentityMutation();
  const [updateIdentity, { isLoading: isUpdating }] = useUpdateIdentityMutation();
  const [addPolicy] = useAddIdentityPolicyMutation();
  const [removePolicy] = useRemoveIdentityPolicyMutation();

  const [isSavingPolicies, setIsSavingPolicies] = useState(false);
  const isSaving = isCreating || isUpdating || isSavingPolicies;
  const isEditMode = !!selectedIdentity?._id;

  const policyOptions = useMemo(() => {
    return (policies ?? []).map((p) => p._id);
  }, [policies]);

  const [formValues, setFormValues] = useState<TypeRepresenterValue>({
    identifier: "",
    password: "",
    policies: [] as string[],
  });

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen) {
      if (selectedIdentity) {
        setFormValues({
          identifier: selectedIdentity.identifier ?? "",
          password: "",
          policies: selectedIdentity.policies ?? [],
        });
      } else {
        setFormValues({
          identifier: "",
          password: "",
          policies: [],
        });
      }
      setFormErrors({});
    }
  }, [isOpen, selectedIdentity]);

  const properties: TypeProperties = useMemo(() => ({
    identifier: {
      type: "string",
      title: "Identifier",
      placeholder: "Enter identifier (min 3 characters)",
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
  }), [isEditMode, policyOptions]);

  const handleChange = useCallback((newValues: TypeRepresenterValue) => {
    setFormValues((prev) => ({ ...prev, ...newValues }));
    setFormErrors({});
  }, []);

  const fields = useInputRepresenter({
    properties,
    value: formValues,
    onChange: handleChange,
    error: formErrors,
    errorClassName: styles.error,
  });

  const handleSave = useCallback(async () => {
    const errors: Record<string, string> = {};
    const identifier = String(formValues.identifier ?? "").trim();
    const password = String(formValues.password ?? "").trim();

    if (!identifier || identifier.length < 3) {
      errors.identifier = "Identifier must be at least 3 characters";
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

      if (isEditMode && selectedIdentity?._id) {
        const body: Record<string, any> = { identifier };
        if (password) body.password = password;
        await updateIdentity({ id: selectedIdentity._id, body }).unwrap();

        const existingPolicies = selectedIdentity.policies ?? [];
        const toAdd = selectedPolicies.filter((p) => !existingPolicies.includes(p));
        const toRemove = existingPolicies.filter((p) => !selectedPolicies.includes(p));

        setIsSavingPolicies(true);
        await Promise.all([
          ...toAdd.map((policyId) => addPolicy({ id: selectedIdentity._id!, policyId }).unwrap()),
          ...toRemove.map((policyId) => removePolicy({ id: selectedIdentity._id!, policyId }).unwrap()),
        ]);
        setIsSavingPolicies(false);
      } else {
        const created = await createIdentity({ identifier, password }).unwrap();

        if (selectedPolicies.length > 0 && created._id) {
          setIsSavingPolicies(true);
          await Promise.all(
            selectedPolicies.map((policyId) => addPolicy({ id: created._id!, policyId }).unwrap())
          );
          setIsSavingPolicies(false);
        }
      }
      onClose();
    } catch (error: any) {
      const message = error?.data?.message || "Failed to save identity. Please try again.";
      alert(message);
    }
  }, [formValues, isEditMode, selectedIdentity, createIdentity, updateIdentity, onClose]);

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
        className={styles.drawerContainer}
      >
        <FlexElement
          dimensionX="fill"
          direction="vertical"
          gap={16}
          alignment="leftTop"
          className={styles.drawerContent}
          style={{ flex: 1, overflowY: "auto" }}
        >
          <Text size="large">{isEditMode ? "Edit Identity" : "New Identity"}</Text>
          {fields}
        </FlexElement>

        <FlexElement
          dimensionX="fill"
          direction="horizontal"
          gap={10}
          alignment="rightCenter"
          className={styles.drawerFooter}
        >
          <Button variant="outlined" color="default" onClick={onClose} disabled={isSaving}>
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

export default IdentityDrawer;
