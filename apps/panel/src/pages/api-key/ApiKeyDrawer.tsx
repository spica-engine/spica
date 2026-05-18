import React from "react";
import {Drawer, useInputRepresenter} from "oziko-ui-kit";
import type {ApiKey} from "../../store/api/apiKeyApi";
import {useApiKeyDrawer} from "../../hooks/useApiKeyDrawer";
import {BucketEntryActions} from "../../components/molecules/BucketEntryActions";
import styles from "./ApiKeyDrawer.module.scss";

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
  const {
    isEditMode,
    isSaving,
    formValues,
    formErrors,
    properties,
    handleChange,
    handleSave,
  } = useApiKeyDrawer({isOpen, selectedApiKey, onClose, onKeyCreated});

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
      size={380}
      isOpen={isOpen}
      onClose={onClose}
      showCloseButton={false}
      scrollableContentClassName={styles.scrollableWrapper}
    >
      <div className={styles.drawerContent}>
        <div className={styles.drawerHeader}>
          <div className={styles.drawerHeaderInfo}>
            <div className={styles.drawerTitle}>
              {isEditMode ? "Edit API Key" : "New API Key"}
            </div>
            <div className={styles.drawerSubtitle}>
              API Key&nbsp;·&nbsp;{isEditMode ? "edit key" : "new key"}
            </div>
          </div>
          <button className={styles.drawerClose} onClick={onClose}>
            <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className={styles.drawerBody}>
          {fields}
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
};

export default ApiKeyDrawer;
