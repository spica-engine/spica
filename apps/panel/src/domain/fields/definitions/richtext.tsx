import {Button, Icon} from "oziko-ui-kit";
import {TranslatableMinimalConfig, BaseFields, MinimalConfig} from "../creation-form-schemas";
import {freezeFormDefaults, BASE_FORM_DEFAULTS} from "../defaults";
import {type FieldDefinition, FieldKind, type TypeProperty} from "../types";
import {
  runYupValidation,
  RICHTEXT_FIELD_CREATION_FORM_SCHEMA,
  validateFieldValue
} from "../validation";
import {buildBaseProperty} from "../registry";
import { STRING_DEFINITION } from "./string";

export const RICHTEXT_DEFINITION: FieldDefinition = {
  kind: FieldKind.Richtext,
  display: {label: "Richtext", icon: "formatAlignCenter"},
  creationFormDefaultValues: freezeFormDefaults({
    ...BASE_FORM_DEFAULTS,
    configurationValues: Object.fromEntries(
      Object.keys(TranslatableMinimalConfig).map(key => [key, false])
    ),
    type: FieldKind.Richtext
  }),
  validateCreationForm: form => runYupValidation(RICHTEXT_FIELD_CREATION_FORM_SCHEMA, form),
  validateValue: (value, properties, required) =>
    validateFieldValue(value, FieldKind.Richtext, properties, required),
  buildCreationFormProperties: isInnerField => ({
    fieldValues: BaseFields,
    configurationValues: isInnerField ? MinimalConfig : TranslatableMinimalConfig
  }),
  buildCreationFormApiProperty: buildBaseProperty,
  buildValueProperty: property =>
    ({
      ...property,
      type: FieldKind.Richtext,
      description: undefined,
      id: crypto.randomUUID(),
    }) as TypeProperty,
  getDisplayValue: value => value || "",
  getSaveReadyValue: value => value || "",
  capabilities: {translatable: true},
  renderValue: (value, deletable, className) => (
    <div className={className}>
      <div>{value}</div>
      {deletable && value && (
        <Button variant="icon">
          <Icon name="close" size="sm" />
        </Button>
      )}
    </div>
  ),
  renderInput: STRING_DEFINITION.renderInput
}