import React, { useMemo, useRef } from "react";
import { Drawer, FlexElement, useInputRepresenter } from "oziko-ui-kit";
import { useGetPoliciesQuery } from "../../../store/api/policyApi";
import { useEntityDrawer, type EntityWithPolicies } from "../../../hooks/useEntityDrawer";
import drawerStyles from "../BucketEntryDrawer/BucketEntryDrawer.module.scss";
import formStyles from "../../molecules/BucketEntryForm/BucketEntryForm.module.scss";
import { BucketEntryActions } from "../../molecules/BucketEntryActions/BucketEntryActions";

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
  const formContainerRef = useRef<HTMLDivElement>(null);

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
    containerClassName: formStyles.inputFieldContainer,
  });

  const subtitle = (selectedEntity as any)?.[nameField] ?? (isEditMode ? "edit" : "new");

  return (
    <Drawer
      placement="right"
      size={380}
      isOpen={isOpen}
      onClose={onClose}
      showCloseButton={false}
      scrollableContentClassName={drawerStyles.scrollableWrapper}
    >
      <div className={drawerStyles.drawerContent}>
        <div className={drawerStyles.drawerHeader}>
          <div className={drawerStyles.drawerHeaderInfo}>
            <div className={drawerStyles.drawerTitle}>
              {isEditMode ? `Edit ${entityLabel}` : `New ${entityLabel}`}
            </div>
            <div className={drawerStyles.drawerSubtitle}>
              {entityLabel}&nbsp;·&nbsp;{subtitle}
            </div>
          </div>
          <button className={drawerStyles.drawerClose} onClick={onClose}>
            <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className={drawerStyles.drawerBody} ref={formContainerRef}>
          <FlexElement direction="vertical" gap={10} className={formStyles.formContent}>
            {fields}
          </FlexElement>
        </div>

        <BucketEntryActions
          onSubmit={handleSave}
          onCancel={onClose}
          isLoading={isSaving}
          submitButtonText={isEditMode ? "Save changes" : "Save and close"}
        />
      </div>
    </Drawer>
  );
}

export default EntityDrawer;
