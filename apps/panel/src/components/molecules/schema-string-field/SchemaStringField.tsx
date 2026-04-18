import {Select, StringInput} from "oziko-ui-kit";
import type {ConfigSchemaProperty} from "../../../store/api/configApi";
import {getNestedValue, humanize} from "../../../pages/config/configHelpers";
import styles from "../schema-field-shared.module.scss";

type SchemaStringFieldProps = {
  path: string;
  schema: ConfigSchemaProperty;
  options: Record<string, unknown>;
  onUpdate: (path: string, value: unknown) => void;
};

const SchemaStringField = ({path, schema, options, onUpdate}: SchemaStringFieldProps) => {
  const currentValue = (getNestedValue(options, path) as string) ?? "";
  const fieldKey = humanize(path.split(".").pop()!);
  const description = schema.description;

  if (schema.enum && schema.enum.length > 0) {
    const selectOptions = schema.enum.map(v => ({label: v, value: v}));
    return (
      <div className={styles.fieldRow}>
        <div className={styles.fieldInfo}>
          <span className={styles.fieldLabel}>{fieldKey}</span>
          {description && <span className={styles.fieldDescription}>{description}</span>}
        </div>
        <div className={styles.fieldInput}>
          <Select
            dimensionX="fill"
            dimensionY={36}
            options={selectOptions}
            value={currentValue}
            onChange={v => onUpdate(path, v)}
            placeholder="Select..."
          />
        </div>
      </div>
    );
  }

  return (
    <div className={styles.fieldRow}>
      <div className={styles.fieldInfo}>
        <span className={styles.fieldLabel}>{fieldKey}</span>
        {description && <span className={styles.fieldDescription}>{description}</span>}
      </div>
      <div className={styles.fieldInput}>
        <StringInput
          label={fieldKey}
          value={currentValue}
          onChange={v => onUpdate(path, v)}
        />
      </div>
    </div>
  );
};

export default SchemaStringField;
