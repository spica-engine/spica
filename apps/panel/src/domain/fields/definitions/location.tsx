import {useAdaptivePosition, Portal, LocationInput} from "oziko-ui-kit";
import {useRef, useEffect, type RefObject} from "react";
import {OnlyRequiredConfig, BaseFields} from "../creation-form-schemas";
import {freezeFormDefaults, BASE_FORM_DEFAULTS} from "../defaults";
import {type FieldDefinition, FieldKind} from "../types";
import {
  runYupValidation,
  LOCATION_FIELD_CREATION_FORM_SCHEMA,
  validateFieldValue
} from "../validation";
import styles from "../field-styles.module.scss";

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
  buildValueProperty: property => ({
    type: FieldKind.Location,
    title: property.title,
    description: property.description
  }),
  getFormattedValue: v => {
    if (!v || typeof v !== "object") return "";
    if (Array.isArray((v as any).coordinates)) {
      const coords = (v as any).coordinates;
      if (coords.length >= 2) return `${coords[0]},${coords[1]}`;
    }
    if ("latitude" in (v as any) && "longitude" in (v as any))
      return `${(v as any).latitude},${(v as any).longitude}`;
    return "";
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

    const RenderedValue = ({value}: any) => LOCATION_DEFINITION.renderValue(value, false);
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
