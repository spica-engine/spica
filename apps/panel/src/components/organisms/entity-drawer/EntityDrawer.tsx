import React, { useMemo } from "react";
import { Button, Drawer, FlexElement, Text, useInputRepresenter } from "oziko-ui-kit";
import { useGetPoliciesQuery } from "../../../store/api/policyApi";
import { useEntityDrawer, type EntityWithPolicies } from "../../../hooks/useEntityDrawer";
import styles from "../../../pages/shared/EntityPage.module.scss";

type EntityDrawerProps<TEntity extends EntityWithPolicies> = {
  isOpen: boolean;
  selectedEntity: TEntity | null;
  onClose: () => void;
  entityLabel: string;
  nameField: string;
  createMutation: (arg: any) => { unwrap: () => Promise<TEntity> };
  updateMutation: (arg: any) => { unwrap: () => Promise<TEntity> };
  addPolicyMutation: (arg: any) => { unwrap: () => Promise<any> };
  removePolicyMutation: (arg: any) => { unwrap: () => Promise<any> };
  isCreating: boolean;
  isUpdating: boolean;
};

function EntityDrawer<TEntity extends EntityWithPolicies>({
  isOpen,
  selectedEntity,
  onClose,
  entityLabel,
  nameField,
  createMutation,
  updateMutation,
  addPolicyMutation,
  removePolicyMutation,
  isCreating,
  isUpdating,
}: EntityDrawerProps<TEntity>) {
  const { data: policies } = useGetPoliciesQuery();

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
  } = useEntityDrawer<TEntity>({
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
          <Text size="large">{isEditMode ? `Edit ${entityLabel}` : `New ${entityLabel}`}</Text>
        </FlexElement>
        <FlexElement
          dimensionX="fill"
          dimensionY="fill"
          direction="vertical"
          alignment="leftTop"
          gap={16}
          className={styles.fieldContainer}
        >
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
}

export default EntityDrawer;
