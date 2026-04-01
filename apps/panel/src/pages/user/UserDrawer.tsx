import React, { useMemo } from "react";
import { Button, Drawer, FlexElement, Text, useInputRepresenter } from "oziko-ui-kit";
import {
  useCreateUserMutation,
  useUpdateUserMutation,
  useAddUserPolicyMutation,
  useRemoveUserPolicyMutation,
  type User,
} from "../../store/api/userApi";
import { useGetPoliciesQuery } from "../../store/api/policyApi";
import { useEntityDrawer } from "../../hooks/useEntityDrawer";
import styles from "../shared/EntityPage.module.scss";

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

  const policyOptions = useMemo(() => {
    return (policies ?? []).map((p) => p._id);
  }, [policies]);

  const {
    isEditMode,
    isSaving,
    formValues,
    formErrors,
    properties,
    handleChange,
    handleSave,
  } = useEntityDrawer<User>({
    isOpen,
    selectedEntity: selectedUser,
    nameField: "username",
    policyOptions,
    createMutation: createUser,
    updateMutation: updateUser,
    addPolicyMutation: addPolicy,
    removePolicyMutation: removePolicy,
    isCreating,
    isUpdating,
    onClose,
  });

  const fields = useInputRepresenter({
    properties,
    value: formValues,
    onChange: handleChange,
    error: formErrors,
    errorClassName: styles.error,
    containerClassName: styles.inputFieldContainer,
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
