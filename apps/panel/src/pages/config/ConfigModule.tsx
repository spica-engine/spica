import {useParams} from "react-router-dom";
import {Button} from "oziko-ui-kit";
import SchemaFormRenderer from "../../components/organisms/schema-form-renderer/SchemaFormRenderer";
import GenericKeyValueFields from "../../components/molecules/generic-key-value-fields/GenericKeyValueFields";
import {useGetConfigQuery, useGetConfigSchemasQuery} from "../../store/api/configApi";
import {useConfigForm} from "../../hooks/useConfigForm";
import styles from "./ConfigModule.module.scss";

const ConfigModule = () => {
  const {module} = useParams<{module: string}>();
  const {data: configData, isLoading, error} = useGetConfigQuery(module!, {skip: !module});
  const {data: schemas} = useGetConfigSchemasQuery();

  const moduleSchema = module && schemas ? schemas[module] : undefined;
  const is404 = error && 'status' in error && error.status === 404;

  const {options, setOptions, hasChanges, isSaving, handleUpdate, handleBatchUpdate, handleSave} = useConfigForm({
    module,
    initialOptions: configData?.options,
    moduleSchema,
    is404: !!is404,
  });

  if (!module) return null;

  const sectionLabel = module.charAt(0).toUpperCase() + module.slice(1) + " Configuration";

  if (isLoading) {
    return (
      <div className={styles.contentArea}>
        <p className={styles.sectionLabel}>{sectionLabel}</p>
        <div className={styles.loadingContainer}>
          {Array.from({length: 5}).map((_, i) => (
            <div key={i} className={styles.skeletonRow} />
          ))}
        </div>
      </div>
    );
  }

  if (error && !is404) {
    return (
      <div className={styles.contentArea}>
        <p className={styles.sectionLabel}>{sectionLabel}</p>
        <p className={styles.errorText}>Error loading configuration. Please try again.</p>
      </div>
    );
  }

  return (
    <div className={styles.contentArea}>
      <p className={styles.sectionLabel}>{sectionLabel}</p>
      <div className={styles.moduleContainer}>
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

        <div className={styles.saveRow}>
          <Button
            variant="solid"
            color="primary"
            onClick={handleSave}
            disabled={!hasChanges || isSaving}
            className={styles.saveButton}
          >
            Save changes
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ConfigModule;