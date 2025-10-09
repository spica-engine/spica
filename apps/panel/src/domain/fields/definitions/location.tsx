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

function normalizeCoordinate(num: number) {
  // If already in range, return as-is
  if (num >= -180 && num <= 180) {
    return num;
  }

  if (num < -180) {
    // Calculate how far below -180 we are
    const offset = -180 - num;

    // Determine which 360-block we're in (0-indexed)
    const blockIndex = Math.floor(offset / 360);

    // Position within the current block (0-359)
    const positionInBlock = offset % 360;

    // Even blocks (0, 2, 4...): reflect upward from -180 toward 180
    // Odd blocks (1, 3, 5...): reflect downward from 180 toward -180
    if (blockIndex % 2 === 0) {
      // Even block: -180 → 180 (reflecting upward)
      return -1 * (-180 + positionInBlock);
    } else {
      // Odd block: 180 → -180 (reflecting downward)
      return 180 - positionInBlock;
    }
  } else {
    // num > 180
    // Calculate how far above 180 we are
    const offset = num - 180;

    // Determine which 360-block we're in (0-indexed)
    const blockIndex = Math.floor(offset / 360);

    // Position within the current block (0-359)
    const positionInBlock = offset % 360;

    // Even blocks (0, 2, 4...): reflect downward from 180 toward -180
    // Odd blocks (1, 3, 5...): reflect upward from -180 toward 180
    if (blockIndex % 2 === 0) {
      // Even block: 180 → -180 (reflecting downward)
      return -1 * (180 - positionInBlock);
    } else {
      // Odd block: -180 → 180 (reflecting upward)
      return -180 + positionInBlock;
    }
  }
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
    const lng = locationType === "geojson" ? value?.coordinates?.[1] : value?.lng;
    const lat = locationType === "geojson" ? value?.coordinates?.[0] : value?.lat;
    const normalizedLng = normalizeCoordinate(lng);
    const normalizedLat = lat;

    let coordinates = [normalizedLat, normalizedLng];
    if (normalizedLat > 90 || normalizedLat < -90) {
      coordinates = [normalizedLng, normalizedLat];
    }

    const normalizedValue = {type: "Point", coordinates};
    
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
    if (displayValue.coordinates[1] > 90 || displayValue.coordinates[1] < -90) {
      return {
        type: "Point",
        coordinates: [displayValue.coordinates[1], displayValue.coordinates[0]]
      };
    }
    return {type: "Point", coordinates: [displayValue.coordinates[0], displayValue.coordinates[1]]};
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

    useEffect(() => {
      if (ref.current && ref.current.offsetHeight > 0 && ref.current.offsetWidth > 0) {
        calculatePosition();
      }
    }, [calculatePosition, ref, ref.current?.offsetHeight, ref.current?.offsetWidth]);

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
