import {useAdaptivePosition, Portal, LocationInput} from "oziko-ui-kit";
import {useRef, useEffect, type RefObject} from "react";
import {OnlyRequiredConfig, BaseFields} from "../creation-form-schemas";
import {freezeFormDefaults, BASE_FORM_DEFAULTS} from "../defaults";
import {type FieldDefinition, FieldKind, type TypeProperty} from "../types";
import {
  runYupValidation,
  LOCATION_FIELD_CREATION_FORM_SCHEMA,
  validateFieldValue
} from "../validation";
import styles from "../field-styles.module.scss";

type TypeLocation =
  | {lat: number; lng: number}
  | {
      type: "Point";
      coordinates: [number, number];
    };

export const LOCATION_DEFINITION: FieldDefinition = {
  kind: FieldKind.Location,
  display: {label: "Location", icon: "mapMarker"},
  creationFormDefaultValues: freezeFormDefaults({
    ...BASE_FORM_DEFAULTS,

    configurationValues: Object.fromEntries(
      Object.keys(OnlyRequiredConfig).map(key => [key, false])
    )
  }),
  validateCreationForm: form => runYupValidation(LOCATION_FIELD_CREATION_FORM_SCHEMA, form),
  validateValue: (value, properties, required) =>
    validateFieldValue(value, FieldKind.Location, properties, required),
  buildCreationFormProperties: () => ({
    fieldValues: BaseFields,
    configurationValues: OnlyRequiredConfig
  }),
  buildValueProperty: property =>
    ({
      ...property,
      type: FieldKind.Location,
      description: undefined
    }) as TypeProperty,
  getFormattedValue: value => {
    const DEFAULT_COORDINATES = {type: "Point", coordinates: [36.966667, 30.666667]};
    if (!value) return DEFAULT_COORDINATES;
    if (
      value.type === "Point" &&
      Array.isArray(value.coordinates) &&
      value.coordinates.length === 2
    ) {
      return value;
    }
    if (typeof value.lat === "number" && typeof value.lng === "number") {
      return {type: "Point", coordinates: [value.lat, value.lng]};
    }
    return DEFAULT_COORDINATES;
  },
  capabilities: {indexable: true},
  renderValue: value => {
    const formattedValue = !value
      ? [0, 0]
      : value.type === "Point"
        ? value.coordinates
        : [value.lat, value.lng];
    const handleCopy = (e: React.ClipboardEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.clipboardData.setData("text/plain", e.currentTarget.dataset.full || "");
    };
    return (
      <div className={styles.locationCell}>
        <img src="/locationx.png" className={styles.locationImage} />
        <div data-full={formattedValue.join(", ")} onCopy={handleCopy}>
          {formattedValue.map((c: number) => c?.toFixed(2) + "..").join(", ")}
        </div>
      </div>
    );
  },
  renderInput: ({value, onChange, ref, className}) => {
    const containerRef = useRef<HTMLDivElement>(null);

    const {targetPosition, calculatePosition} = useAdaptivePosition({
      containerRef: containerRef,
      targetRef: ref,
      initialPlacement: "bottom"
    });

    useEffect(calculatePosition, [calculatePosition]);

    const RenderedValue = ({value}: {value: TypeLocation}) =>
      LOCATION_DEFINITION.renderValue(value, false);
    return (
      <div ref={containerRef}>
        <RenderedValue value={value} />
        <Portal>
          <LocationInput
            coordinates={{lat: value?.coordinates?.[0] || 0, lng: value?.coordinates?.[1] || 0}}
            onChange={onChange}
            ref={ref as RefObject<HTMLInputElement | null>}
            title="Location"
            style={{...targetPosition, position: "absolute"}}
          />
        </Portal>
      </div>
    );
  }
};
