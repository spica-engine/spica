import {Button, Icon, ObjectInput, Portal, useAdaptivePosition} from "oziko-ui-kit";
import {TranslatableMinimalConfig, BaseFields} from "../creation-form-schemas";
import {freezeFormDefaults, BASE_FORM_DEFAULTS} from "../defaults";
import {type FieldDefinition, FieldKind, type TypeProperty} from "../types";
import {
  runYupValidation,
  OBJECT_FIELD_CREATION_FORM_SCHEMA,
  validateFieldValue
} from "../validation";
import styles from "../field-styles.module.scss";
import {FIELD_REGISTRY} from "../registry";
import type {TypeInputRepresenterError} from "oziko-ui-kit/build/dist/custom-hooks/useInputRepresenter";
import {useEffect, useRef, type RefObject} from "react";
import type {Property} from "src/services/bucketService";

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
  buildValueProperty: (property, relationHandlers) => {
    const properties = Object.fromEntries(
      Object.entries(property?.properties || {}).map(([key, prop]) => {
        const randomKey = crypto.randomUUID();
        // property.primary or prop.primary is not the value we want to pass here
        relationHandlers?.ensureHandlers((prop as Property).bucketId, randomKey, property.primary);
        return [
          key,
          {
            ...(prop ?? {}),
            className: `${(prop as Property)?.type === "object" ? styles.innerObjectInput : styles.objectProperty}`,
            getOptions: relationHandlers?.getOptionsMap.current[randomKey],
            loadMoreOptions: relationHandlers?.loadMoreOptionsMap.current[randomKey],
            searchOptions: relationHandlers?.searchOptionsMap.current[randomKey],
            totalOptionsLength: relationHandlers?.relationStates[randomKey]?.total || 0,
            description: undefined
          }
        ];
      })
    );

    return {
      ...property,
      type: FieldKind.Object,
      properties,
      description: undefined
    } as TypeProperty;
  },
  requiresInnerFields: _ => true,
  getDefaultValue: property => property.default,
  getFormattedValue: (value, properties) => {
    const initialObject: Record<string, any> = {};

    Object.values(properties.properties || properties || {}).forEach((property: any) => {
      if (property.type === "object") {
        const nestedValue = value?.[property.title];
        initialObject[property.title] = OBJECT_DEFINITION.getFormattedValue(
          nestedValue,
          property.properties
        );
      } else {
        const field = FIELD_REGISTRY?.[property.type as FieldKind];
        const formattedValue = field?.getFormattedValue?.(value?.[property.title], property);
        initialObject[property.title] = formattedValue;
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
  renderInput: ({value, onChange, ref, properties, title, error}) => {
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
          <div
            className={styles.objectInputWrapper}
            ref={ref as RefObject<HTMLDivElement | null>}
            style={{...targetPosition, position: "absolute"}}
          >
            <ObjectInput
              title={title}
              value={value}
              onChange={onChange}
              properties={properties.properties}
              errors={error as TypeInputRepresenterError}
              className={styles.objectInput}
            />
          </div>
        </Portal>
      </div>
    );
  }
};
