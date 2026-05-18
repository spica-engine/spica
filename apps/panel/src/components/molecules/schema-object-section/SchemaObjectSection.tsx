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

const SchemaObjectSection = ({path, schema, options, onBatchUpdate, onUpdate, showHeader = true}: SchemaObjectSectionProps) => {
  if (!schema.properties) return null;

  const title = humanize(path.split(".").pop()!);
  const desc = schema.description;

  return (
    <div className={styles.configBlock}>
      {showHeader && (
        <div className={styles.configBlockHead}>
          <div className={styles.configBlockTitle}>{title}</div>
          {desc && <div className={styles.configBlockDesc}>{desc}</div>}
        </div>
      )}
      {Object.entries(schema.properties).map(([key, propSchema]) => {
        const fieldPath = path ? `${path}.${key}` : key;

        // Nested objects render as sub-section headers (not nested cards)
        if (propSchema.type === "object" && propSchema.properties) {
          const subTitle = humanize(key);
          const subDesc = propSchema.description;
          return (
            <div key={fieldPath} className={styles.subSection}>
              <div className={styles.subSectionTitle}>{subTitle}</div>
              {subDesc && <div className={styles.subSectionDesc}>{subDesc}</div>}
              {Object.entries(propSchema.properties).map(([subKey, subSchema]) => {
                const subPath = `${fieldPath}.${subKey}`;
                return (
                  <SchemaField
                    key={subPath}
                    path={subPath}
                    schema={subSchema}
                    options={options}
                    onBatchUpdate={onBatchUpdate}
                    onUpdate={onUpdate}
                    isNested
                  />
                );
              })}
            </div>
          );
        }

        return (
          <SchemaField
            key={fieldPath}
            path={fieldPath}
            schema={propSchema}
            options={options}
            onBatchUpdate={onBatchUpdate}
            onUpdate={onUpdate}
            isNested
          />
        );
      })}
    </div>
  );
};

export default SchemaObjectSection;
