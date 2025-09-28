import {Button, Icon, ObjectInput, Portal, useAdaptivePosition} from "oziko-ui-kit";
import {TranslatableMinimalConfig, BaseFields} from "../creation-form-schemas";
import {freezeFormDefaults, BASE_FORM_DEFAULTS} from "../defaults";
import {type FieldDefinition, FieldKind} from "../types";
import {
  runYupValidation,
  OBJECT_FIELD_CREATION_FORM_SCHEMA,
  validateFieldValue
} from "../validation";
import styles from "../field-styles.module.scss";
import {FIELD_REGISTRY} from "../registry";
import type {TypeInputRepresenterError} from "oziko-ui-kit/build/dist/custom-hooks/useInputRepresenter";
import {useEffect, useRef, type RefObject} from "react";

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

    Object.values(properties.properties || {}).forEach((property: any) => {
      if (property.type === "object") {
        const nestedValue = value?.[property.title];
        initialObject[property.title] = OBJECT_DEFINITION.getFormattedValue(
          nestedValue,
          property.properties
        );
      } else {
        const field = FIELD_REGISTRY?.[property.type as FieldKind];
        initialObject[property.title] = field?.getFormattedValue?.(
          value?.[property.title],
          property
        );
      }
    });

    return initialObject;
  },
  capabilities: {supportsInnerFields: true},
  renderValue: (value, deletable) => (
    <div>
      <div>{JSON.stringify(value)}</div>
      {deletable && value && (
        <Button variant="icon">
          <Icon name="close" size="sm" />
        </Button>
      )}
    </div>
  ),
  renderInput: ({value, onChange, ref, properties, title, className}) => {
    const containerRef = useRef<HTMLDivElement>(null);

    const {targetPosition, calculatePosition} = useAdaptivePosition({
      containerRef: containerRef,
      targetRef: ref,
      initialPlacement: "bottom"
    });

    useEffect(calculatePosition, [calculatePosition]);

    const RenderedValue = ({value}: {value: any[]}) => OBJECT_DEFINITION.renderValue(value, false);

    return (
      <div ref={containerRef} className={styles.objectInputContainer}>
        <RenderedValue value={value} />
        <Portal>
          <ObjectInput
            ref={ref as RefObject<HTMLInputElement | null>}
            title={title}
            description={"description"}
            value={value}
            onChange={onChange}
            properties={properties.properties}
            errors={properties.errors as TypeInputRepresenterError}
            style={{...targetPosition, position: "absolute"}}
            className={styles.objectInput}
          />
        </Portal>
      </div>
    );
  }
};
