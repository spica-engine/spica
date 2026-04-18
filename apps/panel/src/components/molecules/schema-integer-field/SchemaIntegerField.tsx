import {NumberInput} from "oziko-ui-kit";
import type {ConfigSchemaProperty} from "../../../store/api/configApi";
import {getNestedValue, humanize} from "../../../pages/config/configHelpers";
import styles from "../schema-field-shared.module.scss";

type SchemaIntegerFieldProps = {
  path: string;
  schema: ConfigSchemaProperty;
  options: Record<string, unknown>;
  onUpdate: (path: string, value: unknown) => void;
};

const SchemaIntegerField = ({path, schema, options, onUpdate}: SchemaIntegerFieldProps) => {
  const currentValue = getNestedValue(options, path);
  const numValue = currentValue === undefined || currentValue === null ? undefined : Number(currentValue);
  const fieldKey = path.split(".").pop()!;
  const description = schema.description;

  return (
    <div className={styles.fieldRow}>
      <div className={styles.fieldInfo}>
        <span className={styles.fieldLabel}>{humanize(fieldKey)}</span>
        {description && <span className={styles.fieldDescription}>{description}</span>}
      </div>
      <div className={styles.fieldInput}>
        <NumberInput
          label={fieldKey}
          dimensionX="fill"
          value={numValue}
          onChange={v => onUpdate(path, v ?? 0)}
        />
      </div>
    </div>
  );
};

export default SchemaIntegerField;
