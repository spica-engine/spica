import {useParams} from "react-router-dom";
import {Button, Text} from "oziko-ui-kit";
import Page from "../../components/organisms/page-layout/Page";
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

  const title = module.toUpperCase() + " CONFIGURATION";

  if (isLoading) {
    return (
      <Page title={title}>
        <div className={styles.loadingContainer}>
          {Array.from({length: 5}).map((_, i) => (
            <div key={i} className={styles.skeletonRow} />
          ))}
        </div>
      </Page>
    );
  }

  if (error && !is404) {
    return (
      <Page title={title}>
        <Text>Error loading configuration. Please try again.</Text>
      </Page>
    );
  }

  return (
    <Page title={title}>
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
    </Page>
  );
};

export default ConfigModule;