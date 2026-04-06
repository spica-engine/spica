import {FlexElement, Text} from "oziko-ui-kit";
import {useSchemaFieldContext} from "./SchemaFieldContext";
import type {SchemaFieldProps, SchemaFieldRenderer} from "./types";

const ObjectField = ({fieldKey, label, schema, value}: SchemaFieldProps) => {
  const {styles, renderField, onNestedChange} = useSchemaFieldContext();

  const rootKey = fieldKey.split(".").pop()!;
  const nested = value ?? {};

  return (
    <FlexElement key={fieldKey} direction="vertical" dimensionX="fill" gap={6}>
      <Text size="small" dimensionX="fill" className={styles.fieldLabel}>
        {label}
      </Text>
      <div className={styles.nestedGroup}>
        {Object.entries(schema.properties).map(([childKey, childSchema]: [string, any]) =>
          renderField(
            childKey,
            childSchema,
            nested[childKey],
            (val: any) => onNestedChange(rootKey, childKey, val),
            fieldKey
          )
        )}
      </div>
    </FlexElement>
  );
};

export const objectFieldRenderer: SchemaFieldRenderer = {
  match: schema => schema.type === "object" && !!schema.properties,
  Component: ObjectField
};
