import React from "react";
import {
  Button,
  Drawer,
  FlexElement,
  Text,
  useInputRepresenter,
} from "oziko-ui-kit";
import type { ApiKey } from "../../store/api/apiKeyApi";
import { useApiKeyDrawer } from "../../hooks/useApiKeyDrawer";
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
  const {
    isEditMode,
    isSaving,
    formValues,
    formErrors,
    properties,
    handleChange,
    handleSave,
  } = useApiKeyDrawer({ isOpen, selectedApiKey, onClose, onKeyCreated });

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
