import {Button, Icon, useAdaptivePosition, Portal, RichTextInput, Popover} from "oziko-ui-kit";
import {useRef, useEffect, type RefObject} from "react";
import {TranslatableMinimalConfig, BaseFields, MinimalConfig} from "../creation-form-schemas";
import {freezeFormDefaults, BASE_FORM_DEFAULTS} from "../defaults";
import {type FieldDefinition, FieldKind, type TypeProperty} from "../types";
import {
  runYupValidation,
  RICHTEXT_FIELD_CREATION_FORM_SCHEMA,
  validateFieldValue
} from "../validation";
import styles from "../field-styles.module.scss";
import {buildBaseProperty} from "../registry";

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
      description: undefined
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
  renderInput: ({value, onChange, ref, className, onClose}) => {
    const containerRef = useRef<HTMLDivElement>(null);

    const {targetPosition, calculatePosition} = useAdaptivePosition({
      containerRef: containerRef,
      targetRef: ref,
      initialPlacement: "bottom"
    });

    useEffect(calculatePosition, [calculatePosition]);

    const RenderedValue = ({value, className}: {value: string; className: string}) =>
      RICHTEXT_DEFINITION.renderValue(value, false, className);

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    return (
      <div ref={containerRef}>
        <RenderedValue value={value} className={styles.editingRichTextCell} />
        <Popover
          contentProps={{
            ref: ref as RefObject<HTMLDivElement | null>,
            style: targetPosition as React.CSSProperties
          }}
          open
          onClose={onClose}
          content={
            <div
              style={targetPosition || {}}
              ref={ref as RefObject<HTMLDivElement>}
              className={styles.richTextInputContainer}
            >
              <RichTextInput
                value={value}
                onChange={onChange}
                className={`${className} ${styles.richTextInput}`}
                contentProps={{
                  onKeyDown: handleKeyDown,
                  className: styles.richTextInputContent
                }}
              />
            </div>
          }
        />
      </div>
    );
  }
};
