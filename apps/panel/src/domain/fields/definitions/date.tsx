import {Button, Icon, DatePicker} from "oziko-ui-kit";
import {useId, useRef} from "react";
import {MinimalConfig, BaseFields, DefaultInputs} from "../creation-form-schemas";
import {freezeFormDefaults, BASE_FORM_DEFAULTS} from "../defaults";
import {FieldKind, type FieldDefinition, type TypeProperty} from "../types";
import {runYupValidation, DATE_FIELD_CREATION_FORM_SCHEMA, validateFieldValue} from "../validation";
import styles from "../field-styles.module.scss";

function isValidDate(dateObject: any) {
  return dateObject instanceof Date && !isNaN(dateObject.getTime());
}

export const DATE_DEFINITION: FieldDefinition = {
  kind: FieldKind.Date,
  display: {label: "Date", icon: "calendarBlank"},
  creationFormDefaultValues: freezeFormDefaults({
    ...BASE_FORM_DEFAULTS,
    configurationValues: Object.fromEntries(Object.keys(MinimalConfig).map(key => [key, false])),
    defaultValue: {defaultDate: ""}
  }),
  validateCreationForm: form => runYupValidation(DATE_FIELD_CREATION_FORM_SCHEMA, form),
  validateValue: (value, properties, required) =>
    validateFieldValue(value, FieldKind.Date, properties, required),
  buildCreationFormProperties: () => ({
    fieldValues: BaseFields,
    defaultValue: DefaultInputs.defaultDate,
    configurationValues: MinimalConfig
  }),
  buildValueProperty: property => ({
    ...property,
    type: FieldKind.Date,
    description: undefined
  } as TypeProperty),
  getFormattedValue: value => (isValidDate(new Date(value)) ? new Date(value) : null),
  capabilities: {hasDefaultValue: true, indexable: true},
  renderValue: (value, deletable) => {
    if (!value || !isValidDate(new Date(value))) return "";
    const dateObj = new Date(value);
    const formattedDate = dateObj.toLocaleString("en-US", {
      month: "numeric",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true
    });

    return (
      <div className={styles.defaultCell}>
        <div className={styles.defaultCellData}>{formattedDate}</div>
        {deletable && value && (
          <Button variant="icon">
            <Icon name="close" size="sm" />
          </Button>
        )}
      </div>
    );
  },
  renderInput: ({value, onChange, ref, floatingElementRef}) => {
    const popupId = useId(); // unique per component instance
    const observer = useRef<MutationObserver | null>(null);

    const handleOpenChange = (open: boolean) => {
      if (!floatingElementRef) return;

      if (open) {
        observer.current = new MutationObserver(() => {
          const popupEl = document.querySelector<HTMLDivElement>(`.${popupId}`);
          if (popupEl) {
            floatingElementRef.current = popupEl;
            observer.current?.disconnect();
          }
        });
        observer.current.observe(document.body, {childList: true, subtree: true});
      } else {
        floatingElementRef.current = null;
        observer.current?.disconnect();
      }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
      if (e.key === "Enter") {
        e.preventDefault(); // prevents popup from opening
        e.stopPropagation(); // stops propagation to DatePicker internal handlers
      }
    };

    return (
      <DatePicker
        value={value}
        onChange={onChange}
        placement="bottomLeft"
        ref={ref as any}
        onOpenChange={handleOpenChange}
        classNames={{popup: {root: popupId}}}
        onKeyDown={handleKeyDown}
      />
    );
  }
};