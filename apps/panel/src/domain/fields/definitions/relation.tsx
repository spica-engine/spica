import {
  Button,
  Icon,
  type TypeSelectRef,
  RelationInput,
  type TypeFluidContainer
} from "oziko-ui-kit";
import type {TypeRelationSelect} from "oziko-ui-kit/dist/components/atoms/relation-input/relation-select/RelationSelect";
import {useRef, useEffect} from "react";
import {BaseFields, SpecializedInputs, RelationFieldConfig} from "../creation-form-schemas";
import {freezeFormDefaults, BASE_FORM_DEFAULTS} from "../defaults";
import {
  FieldKind,
  type FieldCreationFormProperties,
  type FieldDefinition,
  type TypeProperty
} from "../types";
import {
  runYupValidation,
  RELATION_FIELD_CREATION_FORM_SCHEMA,
  validateFieldValue
} from "../validation";
import styles from "../field-styles.module.scss";
import type {BucketType} from "src/services/bucketService";
import {buildBaseProperty} from "../registry";

export const RELATION_DEFINITION: FieldDefinition = {
  kind: FieldKind.Relation,
  display: {label: "Relation", icon: "callMerge"},
  creationFormDefaultValues: freezeFormDefaults({
    ...BASE_FORM_DEFAULTS,
    fieldValues: {
      ...BASE_FORM_DEFAULTS.fieldValues,
      bucket: "",
      relationType: "",
      dependent: false
    },
    configurationValues: Object.fromEntries(
      Object.keys(RelationFieldConfig).map(key => [key, false])
    ),
    type: FieldKind.Relation
  }),
  validateCreationForm: form => runYupValidation(RELATION_FIELD_CREATION_FORM_SCHEMA, form),
  validateValue: (value, properties, required) =>
    validateFieldValue(value, FieldKind.Relation, properties, required),
  buildCreationFormProperties: (_, buckets?: BucketType[]) =>
    ({
      fieldValues: {
        ...BaseFields,
        bucket: {
          ...SpecializedInputs.bucket,
          enum: buckets?.map(b => ({label: b.title, value: b._id})) || []
        },
        relationType: SpecializedInputs.relationType
      },
      configurationValues: RelationFieldConfig
    }) as unknown as FieldCreationFormProperties,
  buildValueProperty: (property, relationProps) => {
    return {
      ...property,
      type: FieldKind.Relation,
      ...relationProps,
      description: undefined,
      id: crypto.randomUUID(),
    } as TypeProperty;
  },
  buildCreationFormApiProperty: form => {
    const base = buildBaseProperty(form);
    const fv = form.fieldValues;
    return {
      ...base,
      relationType: fv.relationType,
      bucketId: fv.bucket,
      dependent: fv.dependent || undefined
    };
  },
  getDisplayValue: (value, property) => {
    if (!value) return null;
    const primaryKey = property?.relationState?.primaryKey;

    const initialFormattedValues = property?.relationState?.initialFormattedValues;
    const getValue = (v: {_id?: string; value?: string}) => v._id ?? v.value ?? v;
    const getLabel = (v: {[key: string]: string}) =>
      v[primaryKey] ??
      v.label ??
      initialFormattedValues?.label ??
      initialFormattedValues?.find(
        (i: {value: string; _id: string}) =>
          i.value === v.value || i.value === v._id || (typeof v === "string" && i.value === v)
      )?.label;

    if (property?.relationType === "onetomany") {
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
  getSaveReadyValue: (value, property) => {
    const displayValue = RELATION_DEFINITION.getDisplayValue(value, property);
    if (property?.relationType !== "onetomany") return displayValue?.value;
    const payload = Array.isArray(displayValue)
      ? displayValue.map(i => i.value)
      : displayValue?.value
        ? [displayValue?.value]
        : [];
    return payload;
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
