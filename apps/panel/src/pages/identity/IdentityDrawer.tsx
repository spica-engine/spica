import React, { useMemo } from "react";
import { Button, Drawer, FlexElement, FluidContainer, Text, useInputRepresenter } from "oziko-ui-kit";
import {
  useCreateIdentityMutation,
  useUpdateIdentityMutation,
  useAddIdentityPolicyMutation,
  useRemoveIdentityPolicyMutation,
  type Identity,
} from "../../store/api/identityApi";
import { useGetPoliciesQuery } from "../../store/api/policyApi";
import { useEntityDrawer } from "../../hooks/useEntityDrawer";
import styles from "../shared/EntityPage.module.scss";

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
  } = useEntityDrawer<Identity>({
    isOpen,
    selectedEntity: selectedIdentity,
    nameField: "identifier",
    policyOptions,
    createMutation: createIdentity,
    updateMutation: updateIdentity,
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
          <FlexElement dimensionX="fill" alignment="leftTop" className={styles.drawerTitle}>
            <Text size="large">{isEditMode ? "Edit Identity" : "New Identity"}</Text>
          </FlexElement>
          <FlexElement dimensionX={"fill"} dimensionY="fill" direction="vertical" alignment="leftTop" gap={16} className={styles.fieldContainer}>
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
