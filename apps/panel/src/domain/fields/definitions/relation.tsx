import {
  Button,
  Icon,
  type TypeSelectRef,
  RelationInput,
  type TypeFluidContainer
} from "oziko-ui-kit";
import type {TypeRelationSelect} from "oziko-ui-kit/build/dist/components/atoms/relation-input/relation-select/RelationSelect";
import {useRef, useEffect} from "react";
import {MinimalConfig, BaseFields, SpecializedInputs} from "../creation-form-schemas";
import {freezeFormDefaults, BASE_FORM_DEFAULTS} from "../defaults";
import {FieldKind, type FieldDefinition, type TypeProperty} from "../types";
import {
  runYupValidation,
  RELATION_FIELD_CREATION_FORM_SCHEMA,
  validateFieldValue
} from "../validation";
import styles from "../field-styles.module.scss";

export const RELATION_DEFINITION: FieldDefinition = {
  kind: FieldKind.Relation,
  display: {label: "Relation", icon: "callMerge"},
  creationFormDefaultValues: freezeFormDefaults({
    ...BASE_FORM_DEFAULTS,
    fieldValues: {
      ...BASE_FORM_DEFAULTS.fieldValues,
      bucket: "",
      relationType: "onetoone",
      dependent: false
    },
    configurationValues: Object.fromEntries(Object.keys(MinimalConfig).map(key => [key, false]))
  }),
  validateCreationForm: form => runYupValidation(RELATION_FIELD_CREATION_FORM_SCHEMA, form),
  validateValue: (value, properties, required) =>
    validateFieldValue(value, FieldKind.Relation, properties, required),
  buildCreationFormProperties: () => ({
    fieldValues: {
      ...BaseFields,
      bucket: SpecializedInputs.bucket,
      relationType: SpecializedInputs.relationType,
      dependent: SpecializedInputs.dependent
    },
    configurationValues: MinimalConfig
  }),
  buildValueProperty: (property, relationProps) => {
    return {
      ...property,
      type: FieldKind.Relation,
      ...relationProps,
      description: undefined
    } as TypeProperty;
  },
  getFormattedValue: (value, property) => {
    if (!value) return null;
    const primaryKey = property?.relationState?.primaryKey;

    const getValue = (v: {_id?: string; value?: string}) => v._id ?? v.value ?? v;
    const getLabel = (v: {[key: string]: string}) => v[primaryKey] ?? v.label ?? v;

    if (property.relationType === "onetomany") {
      const values = Array.isArray(value)
        ? value.map(i => ({value: getValue(i), label: getLabel(i)}))
        : [{value: getValue(value), label: getLabel(value)}];
      return values;
    }

    return {
      value: getValue(value),
      label: getLabel(value)
    };
  },
  capabilities: {indexable: true},
  renderValue: (value, deletable) => (
    <div>
      <div>{value ? JSON.stringify(value) : ""}</div>
      {deletable && value && (
        <Button variant="icon">
          <Icon name="close" size="sm" />
        </Button>
      )}
    </div>
  ),
  renderInput: ({value, onChange, title, properties, floatingElementRef}) => {
    const selectRef = useRef<TypeSelectRef>(null);

    useEffect(() => {
      selectRef.current?.toggleDropdown(true);
    }, [selectRef]);
    console.log("{value, properties}", {value, properties});
    return (
      <RelationInput
        label={title as string}
        description={properties?.description}
        value={value}
        onChange={onChange}
        getOptions={properties.getOptions}
        loadMoreOptions={properties.loadMoreOptions}
        searchOptions={properties.searchOptions}
        totalOptionsLength={properties.relationState?.total}
        multiple={properties?.relationType === "onetomany"}
        selectProps={
          {
            popupClassName: styles.relationSelect,
            optionProps: {className: styles.relationInputOption},
            selectRef,
            root: {className: styles.relationRoot},
            portalClassName: styles.relationPortal
          } as TypeRelationSelect & TypeFluidContainer
        }
        className={styles.relationInput}
        labelProps={undefined}
        externalDropdownRef={floatingElementRef as React.RefObject<HTMLDivElement>}
      />
    );
  }
};
