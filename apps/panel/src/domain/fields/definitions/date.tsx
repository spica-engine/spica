import {Button, Icon, DatePicker} from "oziko-ui-kit";
import {useEffect, useId} from "react";
import {MinimalConfig, BaseFields, DefaultInputs} from "../creation-form-schemas";
import {freezeFormDefaults, BASE_FORM_DEFAULTS} from "../defaults";
import {FieldKind, type FieldDefinition, type TypeProperty} from "../types";
import {runYupValidation, DATE_FIELD_CREATION_FORM_SCHEMA, validateFieldValue} from "../validation";
import styles from "../field-styles.module.scss";
import {buildBaseProperty} from "../registry";

function isValidDate(dateObject: Date) {
  return dateObject instanceof Date && !isNaN(dateObject.getTime());
}

export const DATE_DEFINITION: FieldDefinition = {
  kind: FieldKind.Date,
  display: {label: "Date", icon: "calendarBlank"},
  creationFormDefaultValues: freezeFormDefaults({
    ...BASE_FORM_DEFAULTS,
    configurationValues: Object.fromEntries(Object.keys(MinimalConfig).map(key => [key, false])),
    defaultValue: undefined,
    type: FieldKind.Date
  }),
  validateCreationForm: form => runYupValidation(DATE_FIELD_CREATION_FORM_SCHEMA, form),
  validateValue: (value, properties, required) =>
    validateFieldValue(value, FieldKind.Date, properties, required),
  buildCreationFormProperties: () => ({
    fieldValues: BaseFields,
    defaultValue: DefaultInputs.defaultDate as unknown as TypeProperty,
    configurationValues: MinimalConfig
  }),
  buildValueProperty: property =>
    ({
      ...property,
      type: FieldKind.Date,
      description: undefined,
      id: crypto.randomUUID(),
    }) as TypeProperty,
  buildCreationFormApiProperty: form => {
    const base = buildBaseProperty(form);
    return {
      ...base,
      default: form?.defaultValue?.length ? form.defaultValue : undefined
    };
  },
  getDisplayValue: value => (isValidDate(new Date(value)) ? new Date(value) : null),
  getSaveReadyValue: value => (isValidDate(new Date(value)) ? new Date(value) : null),
  capabilities: {hasDefaultValue: true, indexable: true},
  renderValue: (value, deletable) => {
    if (!value || DATE_DEFINITION.getDisplayValue(value) === null) return "";
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
  renderInput: ({value, onChange, ref, floatingElementRef, onSave}) => {
    const popupId = useId();
    const handlePopupKey = (e: KeyboardEvent) => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      e.stopPropagation();
    };
    
    const handleKey = (e: React.KeyboardEvent) => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      e.stopPropagation();
      onSave?.();
    }

    useEffect(() => {
      if (!floatingElementRef) return;
      const popupElement = document.querySelector(`.${popupId}`) as HTMLDivElement;
      if (popupElement) {
        floatingElementRef.current = popupElement;
        popupElement.style.paddingTop = "5px";
        popupElement.addEventListener("keydown", handlePopupKey);
      }
      return () => {
        if (floatingElementRef) {
          floatingElementRef.current = null;
        }
        if (popupElement) {
          popupElement.removeEventListener("keydown", handlePopupKey);
        }
      };
    }, [floatingElementRef]);

    return (
      <DatePicker
        showTime
        defaultOpen
        format="YYYY-MM-DD HH:mm"
        value={value}
        onChange={onChange}
        placement="bottomLeft"
        ref={ref as React.Ref<any>}
        popupClassName={popupId}
        onKeyDown={handleKey}
      />
    );
  }
};
