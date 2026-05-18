import { useCallback } from "react";
import {
  Button,
  FlexElement,
  Icon,
  Text,
} from "oziko-ui-kit";
import { useGetConfigSchemasQuery } from "../../store/api/configApi";
import type { ConfigItem } from "../../store/api/configApi";
import SchemaFormRenderer from "../../components/organisms/schema-form-renderer/SchemaFormRenderer";
import GenericKeyValueFields from "../../components/molecules/generic-key-value-fields/GenericKeyValueFields";
import { useConfigForm } from "../../hooks/useConfigForm";
import styles from "./Config.module.scss";

type ConfigFormProps = {
  isOpen: boolean;
  selectedConfig: ConfigItem | null;
  onClose: () => void;
};

const ConfigForm = ({ isOpen, selectedConfig, onClose }: ConfigFormProps) => {
  const { data: schemas } = useGetConfigSchemasQuery();

  const moduleSchema = selectedConfig?.module && schemas
    ? schemas[selectedConfig.module]
    : undefined;

  const initialOptions = isOpen && selectedConfig?.options
    ? selectedConfig.options as Record<string, unknown>
    : undefined;

  const { options, setOptions, hasChanges, isSaving, handleUpdate, handleBatchUpdate, handleSave, handleReset } = useConfigForm({
    module: selectedConfig?.module,
    initialOptions,
    moduleSchema,
    onSaveSuccess: onClose,
  });

  const handleCancel = useCallback(() => {
    handleReset(selectedConfig?.options as Record<string, unknown> | undefined);
    onClose();
  }, [selectedConfig, onClose, handleReset]);

  if (!selectedConfig) return null;

  return (
    <div className={styles.drawerForm}>
      <FlexElement
        dimensionX="fill"
        direction="vertical"
        alignment="leftTop"
        gap={10}
        className={styles.drawerContent}
      >
        <Text className={styles.drawerTitle}>
          Edit Configuration: <strong style={{ textTransform: "capitalize" }}>{selectedConfig.module}</strong>
        </Text>

        {moduleSchema ? (
          <SchemaFormRenderer
            schema={moduleSchema}
            options={options}
            onBatchUpdate={handleBatchUpdate}
            onUpdate={handleUpdate}
          />
        ) : (
          <GenericKeyValueFields options={options} setOptions={setOptions} />
        )}
      </FlexElement>

      <FlexElement
        dimensionX="fill"
        alignment="rightCenter"
        direction="horizontal"
        gap={10}
        className={styles.drawerActions}
      >
        <Button variant="solid" color="danger" type="button" onClick={handleCancel}>
          <Icon name="close" />
          Cancel
        </Button>
        <Button
          variant="solid"
          color="primary"
          type="button"
          onClick={handleSave}
          disabled={!hasChanges || isSaving}
        >
          <Icon name="check" />
          Save
        </Button>
      </FlexElement>
    </div>
  );
};

export default ConfigForm;
