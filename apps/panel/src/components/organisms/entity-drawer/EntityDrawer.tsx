import React, { useRef } from "react";
import { Drawer, FlexElement, useInputRepresenter } from "oziko-ui-kit";
import { useEntityDrawer, type EntityWithPolicies } from "../../../hooks/useEntityDrawer";
import drawerStyles from "../BucketEntryDrawer/BucketEntryDrawer.module.scss";
import formStyles from "../../molecules/BucketEntryForm/BucketEntryForm.module.scss";
import { PolicySelectAll } from "../../molecules/PolicySelectAll";
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
  /** Optional content rendered in the drawer body after the form fields. */
  extraContent?: React.ReactNode;
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
  extraContent,
}: EntityDrawerProps<TEntity>) {
  const formContainerRef = useRef<HTMLDivElement>(null);

  const {
    isEditMode,
    isSaving,
    formValues,
    inputValues,
    policyOptions,
    formErrors,
    properties,
    handleChange,
    setAllPolicies,
    handleSave,
  } = useEntityDrawer<TEntity>({
    isOpen,
    selectedEntity,
    nameField,
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
    value: inputValues,
    onChange: handleChange,
    error: formErrors,
    containerClassName: formStyles.inputFieldContainer,
  });

  const selectedPolicyCount = ((formValues.policies as string[] | undefined) ?? []).length;

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
            <PolicySelectAll
              selectedCount={selectedPolicyCount}
              totalCount={policyOptions.length}
              onToggle={setAllPolicies}
              disabled={isSaving}
            />
            {extraContent}
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
