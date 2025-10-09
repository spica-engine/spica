import {useAdaptivePosition, LocationInput, Popover} from "oziko-ui-kit";
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
import {buildBaseProperty} from "../registry";

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
    ),
    type: FieldKind.Location
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
      description: undefined,
      id: crypto.randomUUID()
    }) as TypeProperty,
  buildCreationFormApiProperty: buildBaseProperty,
  getDisplayValue: value => {
    const locationType = getLocationType(value);
    const lng = locationType === "geojson" ? value?.coordinates?.[0] : value?.lng;
    const lat = locationType === "geojson" ? value?.coordinates?.[1] : value?.lat;
    const normalizedValue = {lat, lng};
    
    const normalizedLocationByType = {
      geojson: normalizedValue,
      latlng: normalizedValue,
      none: null,
      unknown: DEFAULT_COORDINATES
    };
    return normalizedLocationByType[locationType];
  },
  getSaveReadyValue: value => {
    const displayValue = LOCATION_DEFINITION.getDisplayValue(value);
    if (displayValue === null) return null;
    return {type: "Point", coordinates: [displayValue.lng, displayValue.lat]};
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
            <div data-full={Object.values(formattedValue).join(", ")} onCopy={handleCopy}>
              {Object.values(formattedValue).map(c => (c as number)?.toFixed(2) + "..").join(", ")}
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

    useEffect(() => {
      if (ref.current && ref.current.offsetHeight > 0 && ref.current.offsetWidth > 0) {
        calculatePosition();
      }
    }, [calculatePosition, ref, ref.current?.offsetHeight, ref.current?.offsetWidth]);

    const RenderedValue = ({value}: {value: TypeLocation}) =>
      LOCATION_DEFINITION.renderValue(value, false);

    const formattedCoordinates = LOCATION_DEFINITION.getDisplayValue(value);

    const inputCoordinates = {
      lat: formattedCoordinates?.lat || DEFAULT_COORDINATES.lat,
      lng: formattedCoordinates?.lng || DEFAULT_COORDINATES.lng
    };
    return (
      <div ref={containerRef}>
        <RenderedValue value={value} />
        <Popover
          contentProps={{
            ref: ref as RefObject<HTMLDivElement | null>,
            style: targetPosition ?? {opacity: 0}
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
