import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Drawer, FlexElement, Text, useInputRepresenter } from "oziko-ui-kit";
import type { TypeProperties, TypeRepresenterValue } from "oziko-ui-kit/dist/custom-hooks/useInputRepresenter";
import {
  useCreateUserMutation,
  useUpdateUserMutation,
  useAddUserPolicyMutation,
  useRemoveUserPolicyMutation,
  type User,
} from "../../store/api/userApi";
import { useGetPoliciesQuery } from "../../store/api/policyApi";
import styles from "./User.module.scss";

type UserDrawerProps = {
  isOpen: boolean;
  selectedUser: User | null;
  onClose: () => void;
};

const UserDrawer: React.FC<UserDrawerProps> = ({ isOpen, selectedUser, onClose }) => {
  const { data: policies } = useGetPoliciesQuery();
  const [createUser, { isLoading: isCreating }] = useCreateUserMutation();
  const [updateUser, { isLoading: isUpdating }] = useUpdateUserMutation();
  const [addPolicy] = useAddUserPolicyMutation();
  const [removePolicy] = useRemoveUserPolicyMutation();

  const [isSavingPolicies, setIsSavingPolicies] = useState(false);
  const isSaving = isCreating || isUpdating || isSavingPolicies;
  const isEditMode = !!selectedUser?._id;

  const policyOptions = useMemo(() => {
    return (policies ?? []).map((p) => p._id);
  }, [policies]);

  const [formValues, setFormValues] = useState<TypeRepresenterValue>({
    username: "",
    password: "",
    policies: [] as string[],
  });

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen) {
      if (selectedUser) {
        setFormValues({
          username: selectedUser.username ?? "",
          password: "",
          policies: selectedUser.policies ?? [],
        });
      } else {
        setFormValues({
          username: "",
          password: "",
          policies: [],
        });
      }
      setFormErrors({});
    }
  }, [isOpen, selectedUser]);

  const properties: TypeProperties = useMemo(() => ({
    username: {
      type: "string",
      title: "Username",
      placeholder: "Enter username (min 3 characters)",
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
    const username = String(formValues.username ?? "").trim();
    const password = String(formValues.password ?? "").trim();

    if (!username || username.length < 3) {
      errors.username = "Username must be at least 3 characters";
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

      if (isEditMode && selectedUser?._id) {
        const body: Record<string, any> = { username };
        if (password) body.password = password;
        await updateUser({ id: selectedUser._id, body }).unwrap();

        const existingPolicies = selectedUser.policies ?? [];
        const toAdd = selectedPolicies.filter((p) => !existingPolicies.includes(p));
        const toRemove = existingPolicies.filter((p) => !selectedPolicies.includes(p));

        setIsSavingPolicies(true);
        await Promise.all([
          ...toAdd.map((policyId) => addPolicy({ id: selectedUser._id!, policyId }).unwrap()),
          ...toRemove.map((policyId) => removePolicy({ id: selectedUser._id!, policyId }).unwrap()),
        ]);
        setIsSavingPolicies(false);
      } else {
        const created = await createUser({ username, password }).unwrap();

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
      const message = error?.data?.message || "Failed to save user. Please try again.";
      alert(message);
    }
  }, [formValues, isEditMode, selectedUser, createUser, updateUser, onClose]);

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
          <Text size="large">{isEditMode ? "Edit User" : "New User"}</Text>
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

export default UserDrawer;
