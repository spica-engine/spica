import type {ConfigSchemaProperty} from "../../../store/api/configApi";
import {humanize} from "../../../pages/config/configHelpers";
import SchemaField from "../schema-field/SchemaField";
import styles from "../schema-field-shared.module.scss";

type BatchUpdater = (updater: (prev: Record<string, unknown>) => Record<string, unknown>) => void;

type SchemaObjectSectionProps = {
  path: string;
  schema: ConfigSchemaProperty;
  options: Record<string, unknown>;
  onBatchUpdate: BatchUpdater;
  onUpdate: (path: string, value: unknown) => void;
  showHeader?: boolean;
};

const SchemaObjectSection = ({path, schema, options, onBatchUpdate, onUpdate, showHeader}: SchemaObjectSectionProps) => {
  if (!schema.properties) return null;

  return (
    <>
      {showHeader && (
        <div className={styles.sectionHeader}>
          {schema.description || humanize(path.split(".").pop()!)}
        </div>
      )}
      {Object.entries(schema.properties).map(([key, propSchema]) => {
        const fieldPath = path ? `${path}.${key}` : key;
        return (
          <SchemaField
            key={fieldPath}
            path={fieldPath}
            schema={propSchema}
            options={options}
            onBatchUpdate={onBatchUpdate}
            onUpdate={onUpdate}
          />
        );
      })}
    </>
  );
};

export default SchemaObjectSection;
