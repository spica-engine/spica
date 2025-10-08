import {Button, Icon, ObjectInput, Popover, useAdaptivePosition} from "oziko-ui-kit";
import {TranslatableMinimalConfig, BaseFields, MinimalConfig} from "../creation-form-schemas";
import {freezeFormDefaults, BASE_FORM_DEFAULTS, DEFAULT_COORDINATES} from "../defaults";
import {
  type FieldDefinition,
  FieldKind,
  type ObjectInputRelationHandlers,
  type TypeProperty
} from "../types";
import {
  runYupValidation,
  OBJECT_FIELD_CREATION_FORM_SCHEMA,
  validateFieldValue
} from "../validation";
import styles from "../field-styles.module.scss";
import {buildBaseProperty, FIELD_REGISTRY} from "../registry";
import type {TypeInputRepresenterError} from "oziko-ui-kit/dist/custom-hooks/useInputRepresenter";
import {useEffect, useRef, type RefObject} from "react";
import type {Property} from "src/services/bucketService";
import type {
  RelationState,
  TypeGetMoreOptionsMap,
  TypeGetOptionsMap,
  TypeSearchOptionsMap
} from "src/hooks/useRelationInputHandlers";
import {RELATION_DEFINITION} from "./relation";
import {LOCATION_DEFINITION} from "./location";
import {NUMBER_DEFINITION} from "./number";

function isObjectEffectivelyEmpty(obj: Object): boolean {
  if (obj === null || obj === undefined) return true;
  if (typeof obj !== "object") return obj === "" || obj === null;

  return Object.values(obj).every(value => isObjectEffectivelyEmpty(value));
}

export const OBJECT_DEFINITION: FieldDefinition = {
  kind: FieldKind.Object,
  display: {label: "Object", icon: "dataObject"},
  creationFormDefaultValues: freezeFormDefaults({
    ...BASE_FORM_DEFAULTS,
    configurationValues: Object.fromEntries(
      Object.keys(TranslatableMinimalConfig).map(key => [key, false])
    ),
    type: FieldKind.Object
  }),
  validateCreationForm: form => runYupValidation(OBJECT_FIELD_CREATION_FORM_SCHEMA, form),
  validateValue: (value, properties, required) =>
    validateFieldValue(value, FieldKind.Object, properties, required),
  buildCreationFormProperties: isInnerField => ({
    fieldValues: BaseFields,
    configurationValues: isInnerField ? MinimalConfig : TranslatableMinimalConfig
  }),
  buildCreationFormApiProperty: form => {
    const base = buildBaseProperty(form);
    const properties = Array.isArray(form.innerFields)
      ? form.innerFields.reduce<Record<string, Property>>((acc, inner) => {
          const innerDef = FIELD_REGISTRY[inner.type as FieldKind];
          if (innerDef?.buildCreationFormApiProperty) {
            acc[inner.fieldValues.title] = innerDef.buildCreationFormApiProperty(inner);
          } else {
            throw new Error(`Cannot build property for field type ${inner?.type}`);
          }
          return acc;
        }, {})
      : undefined;
    return {
      ...base,
      properties
    } as Property;
  },
  buildValueProperty: (rawProperty, relationHandlers) => {
    if (!rawProperty) {
      return {
        type: FieldKind.Object,
        properties: {},
        description: undefined,
        id: crypto.randomUUID(),
      } as TypeProperty;
    }

    const {
      getOptionsMap = {},
      loadMoreOptionsMap = {},
      searchOptionsMap = {},
      relationStates = {}
    } = (relationHandlers || {}) as ObjectInputRelationHandlers;

    const sourceProperties = rawProperty?.properties || {};
    const builtProperties = Object.fromEntries(
      Object.entries(sourceProperties as {[key: string]: Property}).map(([propKey, property]) => {
        const bucketId = property?.bucketId;

        let builtChild;
        switch (property.type) {
          case "object": {
            builtChild = OBJECT_DEFINITION.buildValueProperty(property, relationHandlers);
            break;
          }
          case "relation": {
            const relationHandlerBundle = {
              getOptions: (getOptionsMap as TypeGetOptionsMap)?.[bucketId],
              loadMoreOptions: (loadMoreOptionsMap as TypeGetMoreOptionsMap)?.[bucketId],
              searchOptions: (searchOptionsMap as TypeSearchOptionsMap)?.[bucketId],
              relationState: (relationStates as Record<string, RelationState | undefined>)?.[
                bucketId
              ]
            };
            builtChild = RELATION_DEFINITION.buildValueProperty(
              property,
              relationHandlerBundle as any
            );
            break;
          }
          default: {
            const field = FIELD_REGISTRY[property.type];
            builtChild = field?.buildValueProperty(property);
            break;
          }
        }

        return [propKey, builtChild];
      })
    );

    return {
      ...(rawProperty as Property),
      type: FieldKind.Object,
      properties: builtProperties,
      description: undefined,
      id: crypto.randomUUID(),
    } as TypeProperty;
  },
  requiresInnerFields: _ => true,
  getDefaultValue: property => property.default,
  getDisplayValue: (value, properties) => {
    const result: Record<string, any> = {};
    const propertyArray = Object.values(properties?.properties || properties || {}) as Property[];
    propertyArray.forEach(property => {
      if (property.type === FieldKind.Object) {
        const nestedValue = value?.[property.title];
        result[property.title] = OBJECT_DEFINITION.getDisplayValue(
          nestedValue,
          property.properties as Property
        );
      } else if (property.type === FieldKind.Location) {
        const formattedValue = LOCATION_DEFINITION.getDisplayValue(
          value?.[property.title],
          property
        );
        result[property.title] = formattedValue ?? DEFAULT_COORDINATES;
      } else if (property.type === FieldKind.Number) {
        const formattedValue = NUMBER_DEFINITION.getDisplayValue(value?.[property.title], property);
        result[property.title] = formattedValue ?? "";
      } else {
        const field = FIELD_REGISTRY?.[property.type as FieldKind];
        const fn = field?.getDisplayValue as ((v: any, p: Property) => any) | undefined;
        result[property.title] = fn?.(value?.[property.title], property);
      }
    });
    return result;
  },
  getSaveReadyValue: (value, properties) => {
    const result: Record<string, any> = {};
    const propertyArray = Object.values(properties?.properties || properties || {}) as Property[];
    propertyArray.forEach(property => {
      if (property.type === FieldKind.Object) {
        const nestedValue = value?.[property.title];
        result[property.title] = OBJECT_DEFINITION.getSaveReadyValue(
          nestedValue,
          property.properties as Property
        );
      } else {
        const field = FIELD_REGISTRY?.[property.type as FieldKind];
        const fn = field?.getSaveReadyValue as ((v: any, p: Property) => any) | undefined;
        result[property.title] = fn?.(value?.[property.title], property);
      }
    });
    return result;
  },
  capabilities: {supportsInnerFields: true},
  renderValue: (value, deletable) => {
    if (isObjectEffectivelyEmpty(value)) return "";
    return (
      <div>
        <div>{JSON.stringify(value)}</div>
        {deletable && value && (
          <Button variant="icon">
            <Icon name="close" size="sm" />
          </Button>
        )}
      </div>
    );
  },
  renderInput: ({value, onChange, ref, properties, title, error, onClose}) => {
    const containerRef = useRef<HTMLDivElement>(null);

    const {targetPosition, calculatePosition} = useAdaptivePosition({
      containerRef: containerRef,
      targetRef: ref,
      initialPlacement: "bottom"
    });

    useEffect(calculatePosition, [calculatePosition]);

    const RenderedValue = ({value}: {value: Object}) => OBJECT_DEFINITION.renderValue(value, false);

    return (
      <div ref={containerRef} className={styles.objectInputContainer}>
        <RenderedValue value={value} />
        <Popover
          contentProps={{
            ref: ref as RefObject<HTMLDivElement | null>,
            style: targetPosition ?? {display: "none"}
          }}
          open
          onClose={onClose}
          content={
            <div className={styles.objectInputWrapper}>
              <ObjectInput
                title={title}
                value={value}
                onChange={onChange}
                properties={properties.properties}
                errors={error as TypeInputRepresenterError}
                className={styles.objectInput}
              />
            </div>
          }
        />
      </div>
    );
  }
};
