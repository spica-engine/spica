import {Button, Icon} from "oziko-ui-kit";
import {TranslatableMinimalConfig, BaseFields} from "../creation-form-schemas";
import {freezeFormDefaults, BASE_FORM_DEFAULTS} from "../defaults";
import {type FieldDefinition, FieldKind} from "../types";
import {
  runYupValidation,
  OBJECT_FIELD_CREATION_FORM_SCHEMA,
  validateFieldValue
} from "../validation";
import styles from "../field-styles.module.scss";
import { FIELD_REGISTRY } from "../registry";

export const OBJECT_DEFINITION: FieldDefinition = {
  kind: FieldKind.Object,
  display: {label: "Object", icon: "dataObject"},
  creationFormDefaultValues: freezeFormDefaults({
    ...BASE_FORM_DEFAULTS,
    configurationValues: Object.fromEntries(
      Object.keys(TranslatableMinimalConfig).map(key => [key, false])
    )
  }),
  validateCreationForm: form => runYupValidation(OBJECT_FIELD_CREATION_FORM_SCHEMA, form),
  validateValue: (value, properties, required) =>
    validateFieldValue(value, FieldKind.Object, properties, required),
  buildCreationFormProperties: () => ({
    fieldValues: BaseFields,
    configurationValues: TranslatableMinimalConfig
  }),
  buildValueProperty: property => ({
    type: FieldKind.Object,
    title: property.title,
    description: property.description,
    properties: property.properties
  }),
  requiresInnerFields: _ => true,
  getDefaultValue: property => property.default,
  getFormattedValue: (value, properties) => {
    const initialObject: Record<string, any> = {};

    Object.values(properties || {}).forEach((property: any) => {
      if (property.type === "object") {
        const nestedValue = value?.[property.title];
        initialObject[property.title] = OBJECT_DEFINITION.getFormattedValue(nestedValue, property.properties);
      } else {
        initialObject[property.title] = FIELD_REGISTRY?.[
          property.type as FieldKind
        ]?.getDefaultValue?.(value?.[property.title]);
      }
    });

    return initialObject;
  },
  capabilities: {supportsInnerFields: true},
  renderValue: (value, deletable) => (
    <div className={styles.defaultCell}>
      <div className={styles.defaultCellData}>{JSON.stringify(value)}</div>
      {deletable && value && (
        <Button variant="icon">
          <Icon name="close" size="sm" />
        </Button>
      )}
    </div>
  )
};
