import {useAdaptivePosition, Portal, LocationInput, Popover} from "oziko-ui-kit";
import {useRef, useEffect, type RefObject} from "react";
import {OnlyRequiredConfig, BaseFields} from "../creation-form-schemas";
import {freezeFormDefaults, BASE_FORM_DEFAULTS, DEFAULT_COORDINATES} from "../defaults";
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

function getLocationType(value: any): "geojson" | "latlng" | "unknown" | "none" {
  if (value === null || value === undefined) return "none";
  if (
    value?.type === "Point" &&
    Array.isArray(value?.coordinates) &&
    value.coordinates.length === 2
  ) {
    return "geojson";
  }
  if (typeof value?.lat === "number" && typeof value?.lng === "number") {
    return "latlng";
  }
  return "unknown";
}

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
  getDisplayValue: value => {
    const locationType = getLocationType(value);
    const normalizedLocationByType = {
      geojson: value,
      latlng: {type: "Point", coordinates: [value?.lat, value?.lng]},
      none: null,
      unknown: DEFAULT_COORDINATES
    };
    return normalizedLocationByType[locationType];
  },
  getSaveReadyValue: value => {
    const displayValue = LOCATION_DEFINITION.getDisplayValue(value);
    if (displayValue === null) return null;
    return {lat: displayValue.coordinates[0], lng: displayValue.coordinates[1]};
  },
  capabilities: {indexable: true},
  renderValue: value => {
    const formattedValue = LOCATION_DEFINITION.getDisplayValue(value);
    const handleCopy = (e: React.ClipboardEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.clipboardData.setData("text/plain", e.currentTarget.dataset.full || "");
    };
    return (
      <div className={styles.locationCell}>
        {value && (
          <>
            <img src="/locationx.png" className={styles.locationImage} />
            <div data-full={formattedValue.coordinates.join(", ")} onCopy={handleCopy}>
              {formattedValue.coordinates.map((c: number) => c?.toFixed(2) + "..").join(", ")}
            </div>
          </>
        )}
      </div>
    );
  },
  renderInput: ({value, onChange, ref, onClose}) => {
    const containerRef = useRef<HTMLDivElement>(null);

    const {targetPosition, calculatePosition} = useAdaptivePosition({
      containerRef: containerRef,
      targetRef: ref,
      initialPlacement: "bottom"
    });

    useEffect(calculatePosition, [calculatePosition]);

    const RenderedValue = ({value}: {value: TypeLocation}) =>
      LOCATION_DEFINITION.renderValue(value, false);

    const formattedCoordinates = LOCATION_DEFINITION.getDisplayValue(value);

    const inputCoordinates = {
      lat: formattedCoordinates?.coordinates?.[0] || DEFAULT_COORDINATES.coordinates[0],
      lng: formattedCoordinates?.coordinates?.[1] || DEFAULT_COORDINATES.coordinates[1]
    };
    return (
      <div ref={containerRef}>
        <RenderedValue value={value} />
        <Popover
          contentProps={{
            ref: ref as RefObject<HTMLDivElement | null>,
            style: targetPosition as React.CSSProperties
          }}
          open
          onClose={onClose}
          content={
            <LocationInput
              coordinates={inputCoordinates}
              onChange={onChange}
              ref={ref as RefObject<HTMLInputElement | null>}
              title="Location"
            />
          }
        />
      </div>
    );
  }
};
