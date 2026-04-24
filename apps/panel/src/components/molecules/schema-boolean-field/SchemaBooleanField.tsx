import {Switch} from "oziko-ui-kit";
import type {ConfigSchemaProperty} from "../../../store/api/configApi";
import {getNestedValue, humanize} from "../../../pages/config/configHelpers";
import styles from "../schema-field-shared.module.scss";

type SchemaBooleanFieldProps = {
  path: string;
  schema: ConfigSchemaProperty;
  options: Record<string, unknown>;
  onUpdate: (path: string, value: unknown) => void;
};

const SchemaBooleanField = ({path, schema, options, onUpdate}: SchemaBooleanFieldProps) => {
  const currentValue = !!getNestedValue(options, path);
  const fieldKey = humanize(path.split(".").pop()!);
  const description = schema.description;

  return (
    <div className={styles.checkboxRow}>
      <div className={styles.fieldInfo}>
        <span className={styles.fieldLabel}>{fieldKey}</span>
        {description && <span className={styles.fieldDescription}>{description}</span>}
      </div>
      <Switch checked={currentValue} onChange={checked => onUpdate(path, checked)} />
    </div>
  );
};

export default SchemaBooleanField;
