import {
  Button,
  Icon,
  type TypeSelectRef,
  RelationInput,
  type TypeFluidContainer
} from "oziko-ui-kit";
import type {TypeRelationSelect} from "oziko-ui-kit/build/dist/components/atoms/relation-input/relation-select/RelationSelect";
import {useRef, useEffect} from "react";
import useLocalStorage from "../../../hooks/useLocalStorage";
import {useRelationInputHandler} from "../../../hooks/useRelationInputHandlers";
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
  buildValueProperty: (property, relationProps) => ({
    ...property,
    type: FieldKind.Relation,
    ...relationProps,
    description: undefined
  } as TypeProperty),
  getFormattedValue: value => value || null,
  capabilities: {indexable: true},
  renderValue: (value, deletable) => (
    <div className={styles.defaultCell}>
      <div className={styles.defaultCellData}>{JSON.stringify(value)}</div>
      {deletable && value && (
        <Button variant="icon">
          <Icon name="close" size="sm" />
        </Button>
      )}
    </div>
  ),
  renderInput: ({value, onChange, title, properties, floatingElementRef}) => {
    const [token] = useLocalStorage("token", "");
    const {getOptions, loadMoreOptions, searchOptions, totalOptionsLength} =
      useRelationInputHandler(token, properties?.bucketId, properties?.primary);

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
        getOptions={getOptions}
        loadMoreOptions={loadMoreOptions}
        searchOptions={searchOptions}
        totalOptionsLength={totalOptionsLength}
        multiple={properties?.multiple}
        selectProps={
          {optionProps: {className: styles.relationInputOption}, selectRef} as TypeRelationSelect &
            TypeFluidContainer
        }
        className={styles.relationInput}
        labelProps={undefined}
        externalDropdownRef={floatingElementRef as React.RefObject<HTMLDivElement>}
      />
    );
  }
};
