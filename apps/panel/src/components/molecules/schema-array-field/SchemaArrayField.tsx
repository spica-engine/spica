import {useCallback} from "react";
import {Button, Icon, Select, StringInput} from "oziko-ui-kit";
import type {ConfigSchemaProperty} from "../../../store/api/configApi";
import {genId, getNestedValue, setNestedValue, humanize} from "../../../pages/config/configHelpers";
import styles from "../schema-field-shared.module.scss";

type ArrayItemWithId = Record<string, unknown> & {_id: string};

type BatchUpdater = (updater: (prev: Record<string, unknown>) => Record<string, unknown>) => void;

type SchemaArrayFieldProps = {
  path: string;
  schema: ConfigSchemaProperty;
  options: Record<string, unknown>;
  onBatchUpdate: BatchUpdater;
};

const SchemaArrayField = ({path, schema, options, onBatchUpdate}: SchemaArrayFieldProps) => {
  const itemSchema = schema.items;
  if (!itemSchema || itemSchema.type !== "object" || !itemSchema.properties) {
    return null;
  }

  const label = schema.description || humanize(path.split(".").pop()!);
  const itemProps = itemSchema.properties;
  const propKeys = Object.keys(itemProps);

  const items = (getNestedValue(options, path) ?? []) as ArrayItemWithId[];

  const updateItem = useCallback((index: number, field: string, value: unknown) => {
    onBatchUpdate(prev => {
      const list = [...((getNestedValue(prev, path) ?? []) as ArrayItemWithId[])];
      list[index] = {...list[index], [field]: value};
      return setNestedValue(prev, path, list);
    });
  }, [path, onBatchUpdate]);

  const addItem = useCallback(() => {
    onBatchUpdate(prev => {
      const defaults: Record<string, unknown> = {_id: genId()};
      for (const [key, prop] of Object.entries(itemProps)) {
        if (prop.enum && prop.enum.length > 0) {
          defaults[key] = prop.enum[0];
        } else if (prop.type === "boolean") {
          defaults[key] = false;
        } else if (prop.type === "integer" || prop.type === "number") {
          defaults[key] = 0;
        } else {
          defaults[key] = "";
        }
      }
      const list = [...((getNestedValue(prev, path) ?? []) as ArrayItemWithId[]), defaults as ArrayItemWithId];
      return setNestedValue(prev, path, list);
    });
  }, [path, onBatchUpdate, itemProps]);

  const removeItem = useCallback((index: number) => {
    onBatchUpdate(prev => {
      const list = ((getNestedValue(prev, path) ?? []) as ArrayItemWithId[]).filter((_, i) => i !== index);
      return setNestedValue(prev, path, list);
    });
  }, [path, onBatchUpdate]);

  return (
    <div className={styles.arraySection}>
      <div className={styles.arraySectionHeader}>
        <span className={styles.fieldLabel}>{label}</span>
      </div>
      {items.map((item, index) => (
        <div key={item._id} className={styles.arrayRow}>
          {propKeys.map(propKey => {
            const propSchema = itemProps[propKey];
            if (propSchema.enum && propSchema.enum.length > 0) {
              return (
                <Select
                  key={propKey}
                  dimensionX="fill"
                  dimensionY={36}
                  options={propSchema.enum.map(v => ({label: v, value: v}))}
                  value={(item[propKey] as string) ?? ""}
                  onChange={v => updateItem(index, propKey, v)}
                  placeholder={humanize(propKey)}
                />
              );
            }
            return (
              <StringInput
                key={propKey}
                label={humanize(propKey)}
                value={String(item[propKey] ?? "")}
                onChange={v => updateItem(index, propKey, v)}
              />
            );
          })}
          <Button
            variant="icon"
            color="danger"
            onClick={() => removeItem(index)}
            className={styles.removeButton}
          >
            <Icon name="close" />
          </Button>
        </div>
      ))}
      <Button variant="text" color="primary" onClick={addItem} className={styles.addButton}>
        <Icon name="plus" /> Add
      </Button>
    </div>
  );
};

export default SchemaArrayField;
