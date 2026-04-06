import {FlexElement, Icon, Input, Select, Text} from "oziko-ui-kit";
import {useSchemaFieldContext} from "./SchemaFieldContext";
import type {SchemaFieldProps, SchemaFieldRenderer} from "./types";

const ArrayObjectField = ({fieldKey, label, schema, value}: SchemaFieldProps) => {
  const {styles, onArrayItemAdd, onArrayItemRemove, onArrayItemChange} = useSchemaFieldContext();

  const rootKey = fieldKey.split(".").pop()!;
  const items: any[] = value ?? [];
  const itemProps = schema.items.properties;

  return (
    <FlexElement key={fieldKey} direction="vertical" alignment="leftCenter" dimensionX="fill" gap={6}>
      <FlexElement dimensionX="fill" alignment="rightCenter">
        <Text size="small" className={styles.fieldLabel}>{label}</Text>
        <button
          type="button"
          className={styles.addRowButton}
          onClick={() => onArrayItemAdd(rootKey)}
        >
          <Icon name="plus" size="sm" />
        </button>
      </FlexElement>
      {items.map((item, idx) => (
        <FlexElement key={idx} dimensionX="fill" gap={6} alignment="leftCenter" className={styles.arrayRow}>
          {Object.entries(itemProps).map(([propKey, propSchema]: [string, any]) => {
            const propLabel = propSchema.title ?? propKey;
            if (propSchema.enum) {
              const opts = (propSchema.enum as string[]).map((v: string) => ({label: v, value: v}));
              return (
                <Select
                  key={propKey}
                  options={opts}
                  value={item[propKey] ?? ""}
                  onChange={v => onArrayItemChange(rootKey, idx, propKey, v as string)}
                  placeholder={propLabel}
                  dimensionX="fill"
                />
              );
            }
            return (
              <FlexElement key={propKey} gap={5} className={styles.inputContainer}>
                <Input
                  placeholder={propLabel}
                  value={item[propKey] ?? ""}
                  onChange={e => onArrayItemChange(rootKey, idx, propKey, e.target.value)}
                  className={styles.input}
                  type="text"
                />
              </FlexElement>
            );
          })}
          <button
            type="button"
            className={styles.removeRowButton}
            onClick={() => onArrayItemRemove(rootKey, idx)}
          >
            <Icon name="close" size="sm" />
          </button>
        </FlexElement>
      ))}
    </FlexElement>
  );
};

export const arrayObjectFieldRenderer: SchemaFieldRenderer = {
  match: schema =>
    schema.type === "array" &&
    schema.items?.type === "object" &&
    !!schema.items?.properties,
  Component: ArrayObjectField
};
