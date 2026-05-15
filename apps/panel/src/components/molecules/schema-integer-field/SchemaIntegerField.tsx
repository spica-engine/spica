import type {ConfigSchemaProperty} from "../../../store/api/configApi";
import {getNestedValue, humanize} from "../../../pages/config/configHelpers";
import styles from "../schema-field-shared.module.scss";

type SchemaIntegerFieldProps = {
  path: string;
  schema: ConfigSchemaProperty;
  options: Record<string, unknown>;
  onUpdate: (path: string, value: unknown) => void;
  isNested?: boolean;
};

const SchemaIntegerField = ({path, schema, options, onUpdate, isNested = false}: SchemaIntegerFieldProps) => {
  const currentValue = getNestedValue(options, path);
  const numValue = currentValue === undefined || currentValue === null ? "" : String(currentValue);
  const fieldKey = path.split(".").pop()!;
  const description = schema.description;

  const row = (
    <div className={styles.fieldRow}>
      <div className={styles.fieldInfo}>
        <span className={styles.fieldLabel}>{humanize(fieldKey)}</span>
        {description && <span className={styles.fieldDescription}>{description}</span>}
      </div>
      <div className={styles.fieldInput}>
        <span className={styles.numFieldKey}>{fieldKey}</span>
        <div className={styles.settingNumInput}>
          <div className={styles.numIcon}>
            <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <line x1="4" y1="9" x2="20" y2="9" />
              <line x1="4" y1="15" x2="20" y2="15" />
              <line x1="10" y1="3" x2="8" y2="21" />
              <line x1="16" y1="3" x2="14" y2="21" />
            </svg>
          </div>
          <input
            type="number"
            className={styles.numInput}
            value={numValue}
            placeholder="—"
            onChange={e => onUpdate(path, e.target.value !== "" ? Number(e.target.value) : 0)}
          />
        </div>
      </div>
    </div>
  );

  if (isNested) return row;

  return <div className={styles.standaloneCard}>{row}</div>;
};

export default SchemaIntegerField;
