import { Button, Icon, useAdaptivePosition, Portal, RichTextInput } from "oziko-ui-kit";
import { useRef, useEffect, type RefObject } from "react";
import { TranslatableMinimalConfig, BaseFields } from "../creation-form-schemas";
import { freezeFormDefaults, BASE_FORM_DEFAULTS } from "../defaults";
import { type FieldDefinition, FieldKind } from "../types";
import { runYupValidation, RICHTEXT_FIELD_CREATION_FORM_SCHEMA, validateFieldValue } from "../validation";

export const RICHTEXT_DEFINITION: FieldDefinition = {
  kind: FieldKind.Richtext,
  display: {label: "Richtext", icon: "formatAlignCenter"},
  creationFormDefaultValues: freezeFormDefaults({
    ...BASE_FORM_DEFAULTS,
    configurationValues: Object.fromEntries(
      Object.keys(TranslatableMinimalConfig).map(key => [key, false])
    )
  }),
  validateCreationForm: form => runYupValidation(RICHTEXT_FIELD_CREATION_FORM_SCHEMA, form),
  validateValue: (value, properties, required) =>
    validateFieldValue(value, FieldKind.Richtext, properties, required),
  buildCreationFormProperties: () => ({
    fieldValues: BaseFields,
    configurationValues: TranslatableMinimalConfig
  }),
  buildValueProperty: property => ({
    type: FieldKind.Richtext,
    title: property.title,
    description: property.description
  }),
  getFormattedValue: v => (v ? "[rich]" : ""),
  capabilities: {translatable: true},
  renderValue: (value, deletable) => (
    <div className={styles.defaultCell}>
      <div className={styles.defaultCellData}>{value}</div>
      {deletable && value && (
        <Button variant="icon">
          <Icon name="close" size="sm" />
        </Button>
      )}
    </div>
  ),
  renderInput: ({value, onChange, ref, className}) => {
    const containerRef = useRef<HTMLDivElement>(null);

    const {targetPosition, calculatePosition} = useAdaptivePosition({
      containerRef: containerRef,
      targetRef: ref,
      initialPlacement: "bottom"
    });

    useEffect(calculatePosition, [calculatePosition]);

    const RenderedValue = ({value}: any) => RICHTEXT_DEFINITION.renderValue(value, false);

    return (
      <div ref={containerRef}>
        <RenderedValue value={value} />
        <Portal>
          <RichTextInput
            value={value}
            onChange={onChange}
            className={className}
            ref={ref as RefObject<HTMLDivElement | null>}
            style={{...targetPosition, position: "absolute"}}
          />
        </Portal>
      </div>
    );
  }
};