/**
 * Field Registry
 * ------------------------------------------------------------
 * Central access to field definitions. Each definition encapsulates
 * defaults, property construction, parsing, formatting and validation.
 */

import {
  ArrayInput,
  Button,
  Checkbox,
  DatePicker,
  Icon,
  Input,
  LocationInput,
  Popover,
  Portal,
  RelationInput,
  Select,
  TextAreaInput,
  useAdaptivePosition,
  type TypeSelectRef
} from "oziko-ui-kit";
import {BASE_FORM_DEFAULTS, freezeFormDefaults} from "./defaults";
import {applyPresetLogic} from "./presets";
import {type FieldDefinition, FieldKind} from "./types";
import {
  runYupValidation,
  STRING_FIELD_CREATION_FORM_SCHEMA,
  NUMBER_FIELD_CREATION_FORM_SCHEMA,
  BOOLEAN_FIELD_CREATION_FORM_SCHEMA,
  DATE_FIELD_CREATION_FORM_SCHEMA,
  TEXTAREA_FIELD_CREATION_FORM_SCHEMA,
  MULTISELECT_FIELD_CREATION_FORM_SCHEMA,
  RELATION_FIELD_CREATION_FORM_SCHEMA,
  LOCATION_FIELD_CREATION_FORM_SCHEMA,
  ARRAY_FIELD_CREATION_FORM_SCHEMA,
  OBJECT_FIELD_CREATION_FORM_SCHEMA,
  FILE_FIELD_CREATION_FORM_SCHEMA,
  RICHTEXT_FIELD_CREATION_FORM_SCHEMA,
  JSON_FIELD_CREATION_FORM_SCHEMA,
  COLOR_FIELD_CREATION_FORM_SCHEMA,
  validateFieldValue
} from "./validation";
import type {
  TypeInputRepresenterError,
  TypeInputTypeMap
} from "oziko-ui-kit/build/dist/custom-hooks/useInputRepresenter";
import styles from "./field-styles.module.scss";
import {useEffect, useId, useLayoutEffect, useRef, type ChangeEvent, type RefObject} from "react";
import {isValidDate} from "../../components/organisms/table/EditCellPopover";
import {useRelationInputHandler} from "../../hooks/useRelationInputHandlers";
import useLocalStorage from "../../hooks/useLocalStorage";
import type {TypeRelationSelect} from "oziko-ui-kit/build/dist/components/atoms/relation-input/relation-select/RelationSelect";

export function resolveFieldKind(input: string): FieldKind | undefined {
  if (!input) return undefined;
  if ((Object.values(FieldKind) as string[]).includes(input)) return input as FieldKind;
  return SYNONYM_MAP[input.toLowerCase()];
}

export function isFieldKind(value: string): value is FieldKind {
  return (Object.values(FieldKind) as string[]).includes(value);
}

function buildOptions(configurationValues: Record<string, any>): {
  [key: string]: any;
} {
  const {index, uniqueValues, translate, readOnly, primaryField, requiredField} =
    configurationValues || {};
  return {
    position: "bottom",
    index: index || undefined,
    unique: uniqueValues || undefined,
    translate: translate || undefined,
    primary: primaryField || undefined,
    required: requiredField || undefined,
    readOnly: readOnly || undefined
  };
}

/**
 * Inlined schemas from the old properties.ts to construct creation form sections.
 * These are used by buildCreationFormProperties of each field.
 */
const BaseFields = {
  title: {type: "string", title: "Name", required: true},
  description: {type: "textarea", title: "Description"}
} as const;

const DefaultInputs = {
  defaultString: {type: "string", title: "Default Value"},
  defaultNumber: {type: "number", title: "Default Value"},
  defaultBoolean: {type: "boolean", title: "Default value", size: "small"},
  defaultDate: {
    type: "string",
    title: "Default Date",
    enum: [
      {label: "None", value: ""},
      {label: "Created At", value: ":created_at"},
      {label: "Updated At", value: ":updated_at"}
    ] as any[]
  }
} as const;

const ValidationInputs = {
  minNumber: {type: "number", title: "Minimum"},
  maxNumber: {type: "number", title: "Maximum"},
  minItems: {type: "number", title: "Min Items"},
  maxItems: {type: "number", title: "Max Items"},
  definePattern: {type: "boolean", title: "Define Pattern", size: "small"},
  regularExpression: {type: "string", title: "Regex"}
} as const;

const SpecializedInputs = {
  preset: {
    type: "string",
    title: "Presets",
    enum: ["Countries", "Days", "Email", "Phone Number"] as string[]
  },
  makeEnumerated: {type: "boolean", title: "Make field enumerated", size: "small"},
  enumeratedValues: {type: "chip", title: "EnumeratedValues"},
  multipleSelectionType: {
    type: "string",
    title: "Type",
    enum: ["string", "number"] as string[],
    required: true
  },
  arrayType: {
    type: "string",
    title: "Array Type",
    enum: [
      "string",
      "date",
      "number",
      "textarea",
      "boolean",
      "color",
      "storage",
      "multiselect",
      "location",
      "richtext",
      "object",
      "json"
    ] as string[],
    required: true
  },
  arrayItemTitle: {type: "string", title: "Title"},
  arrayItemDescription: {type: "string", title: "Description"},
  chip: {type: "chip", title: ""},
  bucket: {title: "Buckets", type: "select", enum: [] as any[]},
  relationType: {
    title: "Relation Type",
    type: "select",
    enum: [
      {label: "One To One", value: "onetoone"},
      {label: "One To Many", value: "onetomany"}
    ] as any[]
  },
  dependent: {type: "boolean", title: "Dependent", size: "small"},
  uniqueItems: {type: "boolean", title: "Items should be unique", size: "small"}
} as const;

// Preset panel used by string and array, and pattern for number/array
const PresetPanel = {
  preset: SpecializedInputs.preset,
  makeEnumerated: SpecializedInputs.makeEnumerated,
  enumeratedValues: {
    ...SpecializedInputs.enumeratedValues,
    renderCondition: {field: "makeEnumerated", equals: true}
  },
  definePattern: ValidationInputs.definePattern,
  regularExpression: {
    ...ValidationInputs.regularExpression,
    renderCondition: {field: "definePattern", equals: true}
  }
} as const;

// Configuration field definitions and mappings
const ConfigDefs = {
  primaryField: {type: "boolean", title: "Primary Field", size: "small"},
  translate: {type: "boolean", title: "Translatable", size: "small"},
  uniqueValues: {type: "boolean", title: "Unique Values", size: "small"},
  requiredField: {type: "boolean", title: "Required Field", size: "small"},
  index: {type: "boolean", title: "Indexed field in database", size: "small"}
} as const;

const BasicConfig = {
  primaryField: ConfigDefs.primaryField,
  uniqueValues: ConfigDefs.uniqueValues,
  requiredField: ConfigDefs.requiredField,
  index: ConfigDefs.index
} as const;

const TranslatableConfig = {
  ...BasicConfig,
  translate: ConfigDefs.translate
} as const;

const MinimalConfig = {
  requiredField: ConfigDefs.requiredField,
  index: ConfigDefs.index
} as const;

const OnlyRequiredConfig = {
  requiredField: ConfigDefs.requiredField
} as const;

const PrimaryAndIndexConfig = {
  primaryField: ConfigDefs.primaryField,
  index: ConfigDefs.index
} as const;

const TranslatableMinimalConfig = {
  translate: ConfigDefs.translate,
  requiredField: ConfigDefs.requiredField,
  index: ConfigDefs.index
} as const;

// ---------------------------------------------------------------------------
// Field Definitions
// ---------------------------------------------------------------------------
const STRING_DEFINITION: FieldDefinition = {
  kind: FieldKind.String,
  display: {label: "String", icon: "formatQuoteClose"},
  creationFormDefaultValues: freezeFormDefaults({
    ...BASE_FORM_DEFAULTS,
    configurationValues: Object.fromEntries(
      Object.keys(TranslatableConfig).map(key => [key, false])
    ),
    defaultValue: ""
  }),
  getDefaultValue: property => property.default,
  validateCreationForm: form => runYupValidation(STRING_FIELD_CREATION_FORM_SCHEMA, form),
  validateValue: (value, properties, required) =>
    validateFieldValue(value, FieldKind.String, properties, required),
  buildCreationFormProperties: () => ({
    fieldValues: BaseFields,
    presetValues: PresetPanel,
    defaultValue: DefaultInputs.defaultString,
    configurationValues: TranslatableConfig
  }),
  buildValueProperty: property => ({
    type: FieldKind.String as any, //keyof TypeInputTypeMap,
    title: property.title,
    description: property.description,
    enum: property.enum
  }),
  applyPresetLogic: (form, oldValues) => applyPresetLogic(FieldKind.String, form, oldValues),
  getFormattedValue: value => (value == null ? "" : String(value)),
  capabilities: {
    enumerable: true,
    pattern: true,
    hasDefaultValue: true,
    translatable: true,
    primaryEligible: true,
    uniqueEligible: true,
    indexable: true
  },
  renderValue: (value, deletable) => {
    return (
      <div className={styles.defaultCell}>
        <div className={styles.defaultCellData}>{value}</div>
        {deletable && value && (
          <Button variant="icon">
            <Icon name="close" size="sm" />
          </Button>
        )}
      </div>
    );
  },
  renderInput: ({value, onChange, ref, properties, title, floatingElementRef, className}) => {
    const selectRef = useRef<TypeSelectRef>(null);

    useEffect(() => {
      selectRef.current?.toggleDropdown(true);
    }, [selectRef]);

    return properties.enum ? (
      <Select
        options={properties.enum}
        value={value}
        onChange={val => onChange(val)}
        title={title}
        externalDropdownRef={floatingElementRef}
        className={className}
        selectRef={selectRef}
      />
    ) : (
      <Input
        value={value}
        onChange={e => onChange(e.target.value)}
        ref={ref as RefObject<HTMLInputElement | null>}
        title={title}
        className={className}
      />
    );
  }
};

const NUMBER_DEFINITION: FieldDefinition = {
  kind: FieldKind.Number,
  display: {label: "Number", icon: "numericBox"},
  creationFormDefaultValues: freezeFormDefaults({
    ...BASE_FORM_DEFAULTS,
    configurationValues: Object.fromEntries(Object.keys(BasicConfig).map(key => [key, false])),
    defaultValue: undefined,
    fieldValues: {
      ...BASE_FORM_DEFAULTS.fieldValues,
      makeEnumerated: false,
      enumeratedValues: [],
      minimum: undefined,
      maximum: undefined
    }
  }),
  validateCreationForm: form => runYupValidation(NUMBER_FIELD_CREATION_FORM_SCHEMA, form),
  validateValue: (value, properties, required) =>
    validateFieldValue(value, FieldKind.Number, properties, required),
  buildCreationFormProperties: () => ({
    fieldValues: {
      ...BaseFields,
      minimum: ValidationInputs.minNumber,
      maximum: ValidationInputs.maxNumber,
      makeEnumerated: SpecializedInputs.makeEnumerated,
      enumeratedValues: {
        ...SpecializedInputs.enumeratedValues,
        valueType: "number",
        renderCondition: {field: "makeEnumerated", equals: true}
      }
    },
    defaultValue: DefaultInputs.defaultNumber,
    configurationValues: BasicConfig
  }),
  buildValueProperty: property => ({
    type: FieldKind.Number,
    title: property.title,
    description: property.description,
    enum: property.enum
  }),
  getDefaultValue: property => property.default,
  getFormattedValue: value => (value == null ? "" : value),
  capabilities: {
    enumerable: true,
    numericConstraints: true,
    pattern: true,
    hasDefaultValue: true,
    primaryEligible: true,
    uniqueEligible: true,
    indexable: true
  },
  renderValue: (value, deletable) => {
    return (
      <div className={styles.defaultCell}>
        <div className={styles.defaultCellData}>{value}</div>
        {deletable && value && (
          <Button variant="icon">
            <Icon name="close" size="sm" />
          </Button>
        )}
      </div>
    );
  },
  renderInput: ({value, onChange, ref, properties, title, floatingElementRef, className}) => {
    const selectRef = useRef<TypeSelectRef>(null);

    useEffect(() => {
      selectRef.current?.toggleDropdown(true);
    }, [selectRef]);

    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      const isEmptyString = value === "";
      onChange?.(isEmptyString ? undefined : Number(value));
    };

    return properties.enum ? (
      <Select
        options={properties.enum}
        value={value}
        onChange={val => onChange(val)}
        title={title}
        externalDropdownRef={floatingElementRef}
        className={className}
        selectRef={selectRef}
      />
    ) : (
      <Input
        value={value}
        onChange={handleChange}
        ref={ref as RefObject<HTMLInputElement | null>}
        title={title}
        className={className}
        type="number"
      />
    );
  }
};

const BOOLEAN_DEFINITION: FieldDefinition = {
  kind: FieldKind.Boolean,
  display: {label: "Boolean", icon: "checkboxBlankOutline"},
  creationFormDefaultValues: freezeFormDefaults({
    ...BASE_FORM_DEFAULTS,
    configurationValues: Object.fromEntries(
      Object.keys(PrimaryAndIndexConfig).map(key => [key, false])
    ),
    defaultValue: false
  }),
  validateCreationForm: form => runYupValidation(BOOLEAN_FIELD_CREATION_FORM_SCHEMA, form),
  validateValue: (value, properties, required) =>
    validateFieldValue(value, FieldKind.Boolean, properties, required),
  buildCreationFormProperties: () => ({
    fieldValues: BaseFields,
    defaultValue: DefaultInputs.defaultBoolean,
    configurationValues: PrimaryAndIndexConfig
  }),
  buildValueProperty: property => ({
    type: FieldKind.Boolean,
    title: property.title,
    description: property.description
  }),
  getFormattedValue: v => (v === true ? "✔" : v === false ? "✘" : ""),
  capabilities: {hasDefaultValue: true, primaryEligible: true, indexable: true},
  renderValue: value => (
    <Checkbox className={`${styles.checkbox} ${styles.booleanValue}`} checked={value} />
  ),
  renderInput: ({value, onChange, className}) => (
    <Checkbox
      className={`${className} ${styles.checkbox}`}
      checked={value}
      onChange={() => onChange(!value)}
    />
  )
};

const DATE_DEFINITION: FieldDefinition = {
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
    type: FieldKind.Date,
    title: property.title,
    description: property.description
  }),
  getFormattedValue: v => {
    if (!v) return "";
    try {
      const d = new Date(v);
      if (isNaN(d.getTime())) return String(v);
      return d.toISOString().split("T")[0];
    } catch {
      return String(v);
    }
  },
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

const TEXTAREA_DEFINITION: FieldDefinition = {
  kind: FieldKind.Textarea,
  display: {label: "Textarea", icon: "formatColorText"},
  creationFormDefaultValues: freezeFormDefaults({
    ...BASE_FORM_DEFAULTS,
    configurationValues: Object.fromEntries(
      Object.keys(TranslatableConfig).map(key => [key, false])
    )
  }),
  validateCreationForm: form => runYupValidation(TEXTAREA_FIELD_CREATION_FORM_SCHEMA, form),
  validateValue: (value, properties, required) =>
    validateFieldValue(value, FieldKind.Textarea, properties, required),
  buildCreationFormProperties: () => ({
    fieldValues: BaseFields,
    configurationValues: TranslatableConfig
  }),
  buildValueProperty: property => ({
    type: FieldKind.Textarea,
    title: property.title,
    description: property.description
  }),
  getFormattedValue: v => (v == null ? "" : String(v)),
  capabilities: {translatable: true, indexable: true},
  renderValue: (value, deletable) => {
    return (
      <div className={styles.defaultCell}>
        <div className={styles.defaultCellData}>{value}</div>
        {deletable && value && (
          <Button variant="icon">
            <Icon name="close" size="sm" />
          </Button>
        )}
      </div>
    );
  },
  renderInput: ({value, onChange, ref, title, className}) => {
    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
      }
    };
    return (
      <TextAreaInput
        value={value}
        onChange={e => onChange(e.target.value)}
        title={title}
        textAreaProps={{
          ref: ref as RefObject<HTMLTextAreaElement>,
          className,
          onKeyDown: handleKeyDown
        }}
        titleRootProps={{className: styles.textAreaTitle}}
      />
    );
  }
};

const MULTISELECT_DEFINITION: FieldDefinition = {
  kind: FieldKind.Multiselect,
  display: {label: "Multiple Selection", icon: "formatListChecks"},
  creationFormDefaultValues: freezeFormDefaults({
    ...BASE_FORM_DEFAULTS,
    fieldValues: {
      ...BASE_FORM_DEFAULTS.fieldValues,
      multipleSelectionType: "string",
      chip: [],
      maxItems: undefined
    },
    configurationValues: Object.fromEntries(Object.keys(MinimalConfig).map(key => [key, false]))
  }),
  validateCreationForm: form => runYupValidation(MULTISELECT_FIELD_CREATION_FORM_SCHEMA, form),
  validateValue: (value, properties, required) =>
    validateFieldValue(value, FieldKind.Multiselect, properties, required),
  buildCreationFormProperties: () => ({
    fieldValues: {
      ...BaseFields,
      multipleSelectionType: SpecializedInputs.multipleSelectionType,
      maxItems: ValidationInputs.maxItems,
      chip: SpecializedInputs.chip
    },
    configurationValues: MinimalConfig
  }),
  buildValueProperty: property => ({
    type: FieldKind.Multiselect,
    title: property.title,
    description: property.description,
    enum: property.enum
  }),
  getFormattedValue: v => (Array.isArray(v) ? v.join(", ") : ""),
  capabilities: {enumerable: true, indexable: true},
  renderValue: (value, deletable) => (
    <div className={styles.multipleSelectionCell}>
      {value?.slice(0, 2)?.map?.((_: any, index: number) => (
        <Button key={index} variant="icon" className={styles.grayBox}>
          {index + 1}
        </Button>
      ))}
      {value?.length > 2 && (
        <Button variant="icon" className={styles.grayBox}>
          <Icon name="dotsHorizontal" size="xs" />
        </Button>
      )}
      <Button variant="icon" className={styles.grayBox}>
        <Icon name="plus" size="xs" />
      </Button>
      {deletable && value && (
        <Button variant="icon">
          <Icon name="close" size="sm" />
        </Button>
      )}
    </div>
  ),
  renderInput: ({value, onChange, properties, title, floatingElementRef}) => {
    const selectRef = useRef<TypeSelectRef>(null);

    useEffect(() => {
      selectRef.current?.toggleDropdown(true);
    }, [selectRef]);

    return (
      <Select
        title={title}
        selectRef={selectRef}
        externalDropdownRef={floatingElementRef}
        disableClick
        options={properties.items.enum || []}
        value={value}
        multiple={true}
        onChange={onChange}
      />
    );
  }
};

const RELATION_DEFINITION: FieldDefinition = {
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
  buildValueProperty: property => ({
    type: FieldKind.Relation,
    title: property.title,
    description: property.description
    // NEEDS TO WAY TO DEFINE
    // getOptions?: () => Promise<TypeLabeledValue[]>;
    // loadMoreOptions?: () => Promise<TypeLabeledValue[]>;
    // searchOptions?: (value: string) => Promise<TypeLabeledValue[]>;
    // totalOptionsLength?: number;
    // THESE ARE NECESSARY FOR RELATION FIELDS
  }),
  getFormattedValue: v => {
    if (!v) return "";
    if (typeof v === "string") return v;
    return (v as any).title || (v as any).name || (v as any)._id || (v as any).id || "";
  },
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
          {optionProps: {className: styles.relationInputOption}, selectRef} as TypeRelationSelect
        }
        className={styles.relationInput}
        labelProps={undefined}
        externalDropdownRef={floatingElementRef as React.RefObject<HTMLDivElement>}
      />
    );
  }
};

const LOCATION_DEFINITION: FieldDefinition = {
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

// DID NOT TESTED FOR COMPOSITE ARRAYS SUCH AS ARRAY OF OBJECTS OR ARRAY OF MULTISELECTS
const ARRAY_DEFINITION: FieldDefinition = {
  kind: FieldKind.Array,
  display: {label: "Array", icon: "ballot"},
  creationFormDefaultValues: freezeFormDefaults({
    ...BASE_FORM_DEFAULTS,
    fieldValues: {
      ...BASE_FORM_DEFAULTS.fieldValues,
      arrayType: "string"
    },
    configurationValues: Object.fromEntries(
      Object.keys(TranslatableMinimalConfig).map(key => [key, false])
    )
  }),
  getDefaultValue: property => property.default,
  validateCreationForm: form => runYupValidation(ARRAY_FIELD_CREATION_FORM_SCHEMA, form),
  validateValue: (value, properties, required) =>
    validateFieldValue(value, FieldKind.Array, properties, required),
  buildCreationFormProperties: () => ({
    fieldValues: {
      ...BaseFields,
      arrayType: SpecializedInputs.arrayType,
      arrayItemTitle: SpecializedInputs.arrayItemTitle,
      arrayItemDescription: SpecializedInputs.arrayItemDescription,
      defaultString: {
        ...DefaultInputs.defaultString,
        renderCondition: {field: "arrayType", equals: "string"}
      },
      defaultBoolean: {
        ...DefaultInputs.defaultBoolean,
        renderCondition: {field: "arrayType", equals: "boolean"}
      },
      defaultNumber: {
        ...DefaultInputs.defaultNumber,
        renderCondition: {field: "arrayType", equals: "number"}
      },
      minNumber: {
        ...ValidationInputs.minNumber,
        renderCondition: {field: "arrayType", equals: "number"}
      },
      maxNumber: {
        ...ValidationInputs.maxNumber,
        renderCondition: {field: "arrayType", equals: "number"}
      },
      makeEnumerated: {
        ...SpecializedInputs.makeEnumerated,
        renderCondition: {field: "arrayType", equals: ["number", "string"]}
      },
      enumeratedValues: {
        ...SpecializedInputs.enumeratedValues,
        valueType: "number",
        renderCondition: {field: "makeEnumerated", equals: true}
      },
      regularExpression: {
        ...ValidationInputs.regularExpression,
        renderCondition: {field: "definePattern", equals: true}
      },
      uniqueItems: {
        ...SpecializedInputs.uniqueItems,
        renderCondition: {
          field: "arrayType",
          notEquals: ["multiselect", "location", "object", "boolean"]
        }
      },
      multipleSelectionType: {
        ...SpecializedInputs.multipleSelectionType,
        renderCondition: {field: "arrayType", equals: "multiselect"}
      },
      minItems: {
        ...ValidationInputs.minItems,
        renderCondition: {field: "arrayType", notEquals: ["multiselect", "location", "object"]}
      },
      maxItems: {
        ...ValidationInputs.maxItems,
        renderCondition: {field: "arrayType", notEquals: ["location", "object"]}
      },
      chip: {
        ...SpecializedInputs.chip,
        renderCondition: {field: "arrayType", equals: "multiselect"}
      }
    },
    // Array reads enum/pattern for number items from presets
    presetValues: {
      definePattern: PresetPanel.definePattern,
      regularExpression: PresetPanel.regularExpression,
      enumeratedValues: PresetPanel.enumeratedValues
    },
    configurationValues: TranslatableMinimalConfig
  }),
  buildValueProperty: property => ({
    type: FieldKind.Array,
    title: property.title,
    description: property.description,
    items: property.items
  }),
  requiresInnerFields: form => form.fieldValues?.arrayType === "object",
  applyPresetLogic: (form, oldValues) =>
    form.fieldValues.arrayType === "string"
      ? applyPresetLogic(FieldKind.String, form, oldValues)
      : form,
  getFormattedValue: v => (Array.isArray(v) ? `${v.length} item${v.length === 1 ? "" : "s"}` : ""),
  capabilities: {supportsInnerFields: true},
  renderValue: (value, deletable) => (
    <div className={styles.multipleSelectionCell}>
      {value?.slice(0, 2)?.map?.((_: any, index: number) => (
        <Button key={index} variant="icon" className={styles.grayBox}>
          {index + 1}
        </Button>
      ))}
      {value?.length > 2 && (
        <Button variant="icon" className={styles.grayBox}>
          <Icon name="dotsHorizontal" size="xs" />
        </Button>
      )}
      <Button variant="icon" className={styles.grayBox}>
        <Icon name="plus" size="xs" />
      </Button>
      {deletable && value && (
        <Button variant="icon">
          <Icon name="close" size="sm" />
        </Button>
      )}
    </div>
  ),
  renderInput: ({value, onChange, ref, properties, title, floatingElementRef}) => {
    const containerRef = useRef<HTMLDivElement>(null);

    const {targetPosition, calculatePosition} = useAdaptivePosition({
      containerRef: containerRef,
      targetRef: ref,
      initialPlacement: "bottom"
    });

    useEffect(calculatePosition, [calculatePosition]);

    const RenderedValue = ({value}: any) => ARRAY_DEFINITION.renderValue(value, false);

    const onChange_ = (val: any) => {
      console.log("Array changed:", val);
      onChange?.(val);
    };
    return (
      <div ref={containerRef}>
        <RenderedValue value={value} />
        <Portal>
          <ArrayInput
            ref={ref as RefObject<HTMLInputElement | null>}
            title={title}
            description={"description"}
            value={value}
            onChange={onChange_}
            minItems={properties.minItems}
            maxItems={properties.maxItems}
            items={properties.items}
            propertyKey={properties.key}
            errors={properties.errors as TypeInputRepresenterError}
            style={{...targetPosition, position: "absolute"}}
            className={styles.arrayInput}
          />
        </Portal>
      </div>
    );
  }
};

const OBJECT_DEFINITION: FieldDefinition = {
  kind: FieldKind.Object,
  display: {label: "Object", icon: "dataObject"},
  creationFormDefaultValues: freezeFormDefaults({
    ...BASE_FORM_DEFAULTS,
    configurationValues: Object.fromEntries(
      Object.keys(TranslatableMinimalConfig).map(key => [key, false])
    )
  }),
  validateCreationForm: form => runYupValidation(OBJECT_FIELD_CREATION_FORM_SCHEMA, form),
  validateValue: (value, properties, required) =>
    validateFieldValue(value, FieldKind.Object, properties, required),
  buildCreationFormProperties: () => ({
    fieldValues: BaseFields,
    configurationValues: TranslatableMinimalConfig
  }),
  buildValueProperty: property => ({
    type: FieldKind.Object,
    title: property.title,
    description: property.description,
    properties: property.properties
  }),
  requiresInnerFields: _ => true,
  getDefaultValue: property => property.default,
  getFormattedValue: v => (v && typeof v === "object" ? `{${Object.keys(v).length}}` : ""),
  capabilities: {supportsInnerFields: true}
};

const FILE_DEFINITION: FieldDefinition = {
  kind: FieldKind.File,
  display: {label: "File", icon: "imageMultiple"},
  creationFormDefaultValues: freezeFormDefaults({
    ...BASE_FORM_DEFAULTS,
    configurationValues: Object.fromEntries(
      Object.keys(TranslatableMinimalConfig).map(key => [key, false])
    )
  }),
  validateCreationForm: form => runYupValidation(FILE_FIELD_CREATION_FORM_SCHEMA, form),
  validateValue: (value, properties, required) =>
    validateFieldValue(value, FieldKind.File, properties, required),
  buildCreationFormProperties: () => ({
    fieldValues: BaseFields,
    configurationValues: TranslatableMinimalConfig
  }),
  buildValueProperty: property => ({
    type: FieldKind.File,
    title: property.title,
    description: property.description
  }),
  getFormattedValue: v => {
    if (!v) return "";
    if (typeof v === "string") return v;
    if (v && typeof v === "object") return (v as any).originalName || (v as any).name || "📎";
    return "📎";
  },
  capabilities: {}
};

const RICHTEXT_DEFINITION: FieldDefinition = {
  kind: FieldKind.Richtext,
  display: {label: "Richtext", icon: "formatAlignCenter"},
  creationFormDefaultValues: freezeFormDefaults({
    ...BASE_FORM_DEFAULTS,
    configurationValues: Object.fromEntries(
      Object.keys(TranslatableMinimalConfig).map(key => [key, false])
    )
  }),
  validateCreationForm: form => runYupValidation(RICHTEXT_FIELD_CREATION_FORM_SCHEMA, form),
  validateValue: (value, properties, required) =>
    validateFieldValue(value, FieldKind.Richtext, properties, required),
  buildCreationFormProperties: () => ({
    fieldValues: BaseFields,
    configurationValues: TranslatableMinimalConfig
  }),
  buildValueProperty: property => ({
    type: FieldKind.Richtext,
    title: property.title,
    description: property.description
  }),
  getFormattedValue: v => (v ? "[rich]" : ""),
  capabilities: {translatable: true}
};

const JSON_DEFINITION: FieldDefinition = {
  kind: FieldKind.Json,
  display: {label: "JSON", icon: "dataObject"},
  creationFormDefaultValues: freezeFormDefaults({
    ...BASE_FORM_DEFAULTS,
    configurationValues: Object.fromEntries(Object.keys(BasicConfig).map(key => [key, false]))
  }),
  validateCreationForm: form => runYupValidation(JSON_FIELD_CREATION_FORM_SCHEMA, form),
  validateValue: (value, properties, required) =>
    validateFieldValue(value, FieldKind.Json, properties, required),
  buildCreationFormProperties: () => ({
    fieldValues: BaseFields,
    configurationValues: BasicConfig
  }),
  buildValueProperty: property => ({
    type: FieldKind.Object, //FieldKind.Json is not in TypeInputTypeMap yet, so we use Object for now, will be fixed later
    title: property.title,
    description: property.description
  }),
  getFormattedValue: v => {
    if (!v) return "";
    try {
      const str = typeof v === "string" ? v : JSON.stringify(v);
      return str.length > 20 ? str.slice(0, 20) + "…" : str;
    } catch {
      return "{…}";
    }
  },
  capabilities: {indexable: true}
};

const COLOR_DEFINITION: FieldDefinition = {
  kind: FieldKind.Color,
  display: {label: "Color", icon: "palette"},
  creationFormDefaultValues: freezeFormDefaults({
    ...BASE_FORM_DEFAULTS,

    configurationValues: Object.fromEntries(Object.keys(BasicConfig).map(key => [key, false]))
  }),
  validateCreationForm: form => runYupValidation(COLOR_FIELD_CREATION_FORM_SCHEMA, form),
  validateValue: (value, properties, required) =>
    validateFieldValue(value, FieldKind.Color, properties, required),
  buildCreationFormProperties: () => ({
    fieldValues: BaseFields,
    configurationValues: BasicConfig
  }),
  buildValueProperty: property => ({
    type: FieldKind.Color as keyof TypeInputTypeMap,
    title: property.title,
    description: property.description
  }),
  getDefaultValue: property => property.default || "#000000",
  getFormattedValue: v => (v ? String(v).toUpperCase() : ""),
  capabilities: {hasDefaultValue: true, indexable: true}
};

export const FIELD_REGISTRY: Partial<Record<FieldKind, FieldDefinition>> = {
  [FieldKind.String]: STRING_DEFINITION,
  [FieldKind.Number]: NUMBER_DEFINITION,
  [FieldKind.Boolean]: BOOLEAN_DEFINITION,
  [FieldKind.Date]: DATE_DEFINITION,
  [FieldKind.Textarea]: TEXTAREA_DEFINITION,
  [FieldKind.Multiselect]: MULTISELECT_DEFINITION,
  [FieldKind.Relation]: RELATION_DEFINITION,
  [FieldKind.Location]: LOCATION_DEFINITION,
  [FieldKind.Array]: ARRAY_DEFINITION,
  [FieldKind.Object]: OBJECT_DEFINITION,
  [FieldKind.File]: FILE_DEFINITION,
  [FieldKind.Richtext]: RICHTEXT_DEFINITION,
  [FieldKind.Json]: JSON_DEFINITION,
  [FieldKind.Color]: COLOR_DEFINITION
};

const SYNONYM_MAP: Record<string, FieldKind> = Object.values(FIELD_REGISTRY).reduce(
  (acc, def) => {
    if (!def) return acc;
    acc[def.display.label.toLowerCase()] = def.kind;
    return acc;
  },
  {} as Record<string, FieldKind>
);
