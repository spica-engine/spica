import {
  type FC,
  memo,
  useMemo,
  useState,
  useCallback,
  useEffect,
  type CSSProperties,
  type ReactHTMLElement,
  useLayoutEffect
} from "react";
import {
  Button,
  FlexElement,
  FluidContainer,
  Icon,
  Tab,
  useInputRepresenter,
  type TypeInputType,
  Text,
  type IconName
} from "oziko-ui-kit";
import styles from "./BucketAddField.module.scss";
import type {BucketType, Property} from "src/services/bucketService";
import BucketFieldPopup, {
  fieldOptions
} from "../../../components/atoms/bucket-field-popup/BucketFieldPopup";
import {getDefaultValues} from "./BucketAddFieldUtils";
import {regexPresets, enumerationPresets} from "./BucketAddFieldPresets";
import {
  createShema,
  presetProperties,
  configPropertiesMapping,
  defaultConfig
} from "./BucketAddFieldSchema";
import {useBucket} from "../../../contexts/BucketContext";

export type SimpleSaveFieldHandlerArg = {
  type: TypeInputType;
  values: Record<string, any>;
};

export type FullSaveFieldHandlerArg = {
  type: TypeInputType;
  fieldValues: Record<string, any>;
  configurationValues: Record<string, any>;
  presetValues?: Record<string, any>;
};

export type TypeSaveFieldHandler = (
  arg: SimpleSaveFieldHandlerArg | FullSaveFieldHandlerArg
) => void | Promise<any>;

type BucketAddFieldProps = {
  name: string;
  type: TypeInputType;
  onSuccess?: () => void;
  onSaveAndClose: TypeSaveFieldHandler;
  bucket: BucketType;
  buckets: BucketType[];
  initialValues?: {
    fieldValues?: Record<string, any>;
    configurationValue?: Record<string, any>;
    presetProperteis?: Record<string, any>;
  };
  className?: string;
  innerFieldStyles?: CSSProperties;
};

type FieldType = {
  fieldValues: Record<string, any>;
  configurationValues: Record<string, any>;
  type: TypeInputType;
};

type InnerFieldProps = {
  field: FieldType;
  bucket?: BucketType;
  buckets: BucketType[];
  setFieldValues: React.Dispatch<React.SetStateAction<Record<string, any>>>;
};

const InnerField: FC<InnerFieldProps> = memo(({field, bucket, buckets, setFieldValues}) => {
  const [isEditing, setIsEditing] = useState(false);

  const handleSaveInnerField = useCallback(
    ({type, fieldValues, configurationValues}: FullSaveFieldHandlerArg) => {
      setFieldValues(prev => ({
        ...prev,
        innerFields: prev.innerFields?.map((innerField: FieldType) =>
          innerField.fieldValues.id === fieldValues.id
            ? {fieldValues, configurationValues, type}
            : innerField
        )
      }));
    },
    []
  );

  const handleDeleteInnerField = useCallback((field: FieldType) => {
    setFieldValues(prev => ({
      ...prev,
      innerFields: prev.innerFields?.filter(
        (innerField: FieldType) => innerField.fieldValues.id !== field.fieldValues.id
      )
    }));
  }, []);

  return (
    <FluidContainer
      dimensionX="fill"
      className={styles.innerFieldItem}
      prefix={{
        children: (
          <FlexElement gap={5} className={styles.innerFieldPrefix}>
            <Icon name={"chevronRight"} size="sm" />
            <Text className={styles.innerFieldName}>{field.fieldValues.title}</Text>
          </FlexElement>
        )
      }}
      root={{children: <Text>{field.type}</Text>}}
      suffix={{
        children: (
          <FlexElement gap={5} dimensionX="fill" className={styles.innerFieldActions}>
            <Button color="default" variant="icon" onClick={() => setIsEditing(true)}>
              <Icon name="pencil" />
            </Button>
            {isEditing && (
              <BucketAddField
                name={field.fieldValues.title}
                type={field.type}
                onSaveAndClose={handleSaveInnerField as TypeSaveFieldHandler}
                bucket={bucket as BucketType}
                buckets={buckets}
                initialValues={{
                  fieldValues: field.fieldValues,
                  configurationValue: field.configurationValues
                }}
                onSuccess={() => setIsEditing(false)}
                className={styles.innerField}
              />
            )}
            <Button color="danger" variant="icon" onClick={() => handleDeleteInnerField(field)}>
              <Icon name="delete" />
            </Button>
          </FlexElement>
        )
      }}
    />
  );
});

const BucketAddField: FC<BucketAddFieldProps> = ({
  name = "",
  type,
  onSuccess,
  onSaveAndClose,
  bucket,
  buckets,
  initialValues,
  className,
  innerFieldStyles
}) => {
  const [schema, setSchema] = useState(createShema[type] || {});
  const defaultFieldValues = useMemo(
    () =>
      initialValues?.fieldValues ??
      getDefaultValues(schema, {
        title: name,
        description: ""
      }),
    [schema, initialValues?.fieldValues]
  );

  const [fieldValues, setFieldValues] = useState<Record<string, any>>(defaultFieldValues);
  const [presetValues, setPresetValues] = useState<Record<string, any>>({});
  const [configurationValue, setConfigurationValue] = useState<Record<string, any>>({});
  const [defaultValue, setDefaultValue] = useState<Record<string, any>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string> | null>(null);
  const [activeTab, setActiveTab] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const {createBucketFieldError} = useBucket();
  const [apiError, setApiError] = useState(createBucketFieldError);

  useEffect(() => {
    setApiError(createBucketFieldError);
  }, [createBucketFieldError]);

  const isInnerFieldsType = useMemo(
    () => (type === "array" && fieldValues.arrayType === "object") || type === "object",
    [type, fieldValues.arrayType]
  );

  useEffect(() => {
    setActiveTab(0);
  }, [isInnerFieldsType, type]);

  const defaultProperty = useMemo(
    () => defaultConfig[type as keyof typeof defaultConfig] || {},
    [type]
  );

  const inputProperties = useMemo(
    () => ({
      ...schema,
      ...(type === "relation" && {
        bucket: {
          ...schema.bucket,
          enum: buckets.map(b => ({label: b.title, value: b._id}))
        }
      })
    }),
    [type, schema, buckets]
  );

  const title = useMemo(() => fieldOptions.find(i => i.type === type), [type]);

  const configFields = useMemo(() => configPropertiesMapping[type], [type]);

  useEffect(() => {
    setFieldValues(defaultFieldValues);
    setConfigurationValue(getDefaultValues(configFields, initialValues?.configurationValue));
    setDefaultValue(getDefaultValues(defaultProperty));
    setFieldErrors(null);
    setApiError(null);
    if (type === "string") {
      setPresetValues(getDefaultValues(presetProperties, initialValues?.presetProperteis));
    } else {
      setPresetValues({});
    }
    setSchema(createShema[type] || {});
  }, [type]);

  useEffect(() => {
    if (fieldValues.arrayType !== "string") {
      setPresetValues({});
    } else setPresetValues(getDefaultValues(presetProperties, initialValues?.presetProperteis));

    if (fieldValues.multipleSelectionType) {
      setSchema(prev => {
        const newValue = {...prev};
        newValue.chip.valueType = fieldValues.multipleSelectionType;
        return newValue;
      });
    }
  }, [fieldValues.arrayType, fieldValues.multipleSelectionType]);

  useEffect(() => {
    if ((type !== "string" && fieldValues.arrayType !== "string") || !presetValues.preset) return;
    const presetKey = presetValues.preset;
    if (presetKey in enumerationPresets) {
      const enumValues = enumerationPresets[presetKey as keyof typeof enumerationPresets];
      setPresetValues(prev => ({
        ...prev,
        enumeratedValues: enumValues as never[],
        regularExpression: "",
        makeEnumerated: true,
        definePattern: false
      }));
    } else if (presetKey in regexPresets) {
      const regexValue = regexPresets[presetKey as keyof typeof regexPresets];
      setPresetValues(prev => ({
        ...prev,
        enumeratedValues: [],
        regularExpression: regexValue,
        makeEnumerated: false,
        definePattern: true
      }));
    }
  }, [type, presetValues.preset, fieldValues.arrayType]);

  useEffect(() => {
    if (type !== "string" && fieldValues.arrayType !== "string") return;
    const presetKey = presetValues.preset;
    if (!presetKey) return;
    const makeEnumerated = presetValues.makeEnumerated;
    if (!makeEnumerated && presetKey in enumerationPresets) {
      setPresetValues(prev => ({...prev, enumeratedValues: [], preset: ""}));
    }
  }, [type, presetValues.makeEnumerated, fieldValues.arrayType]);

  useEffect(() => {
    if (type !== "string" && fieldValues.arrayType !== "string") return;
    const presetKey = presetValues.preset;
    if (!presetKey) return;
    const definePattern = presetValues.definePattern;
    if (!definePattern && presetKey in regexPresets) {
      setPresetValues(prev => ({...prev, regularExpression: "", preset: ""}));
    }
  }, [type, presetValues.definePattern, fieldValues.arrayType]);

  const validateInputs = useCallback(() => {
    setApiError(null);
    const errors: Record<string, string> = {};
    Object.entries(schema).forEach(([key, value]) => {
      if (key === "title" && fieldValues[key] !== fieldValues[key].toLowerCase()) {
        errors[key] = "Name must be in lowercase";
      }
      if (
        value.required &&
        !fieldValues[key] &&
        (!value.renderCondition ||
          fieldValues[value.renderCondition.field] === value.renderCondition.equals)
      ) {
        errors[key] = `${(value as {title: string}).title} is required`;
      }
    });
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }, [schema, fieldValues]);

  useEffect(() => {
    if (!fieldErrors) return;
    validateInputs();
  }, [fieldValues]);

  const handleSaveAndClose = useCallback(async () => {
    const isValid = validateInputs();
    if (!isValid) return;
    setIsLoading(true);

    const payload = {
      type,
      values: {
        ...fieldValues,
        ...configurationValue,
        ...presetValues,
        ...defaultValue,
        requiredField: configurationValue.requiredField ? fieldValues.title : undefined,
        primaryField: configurationValue.primaryField ? fieldValues.title : undefined
      }
    };
    const result = await onSaveAndClose(payload);
    setIsLoading(false);
    if (result) onSuccess?.();
  }, [fieldValues, configurationValue, onSaveAndClose]);

  const handleCreateInnerField = useCallback(
    ({
      type,
      fieldValues,
      configurationValues
    }: {
      type: TypeInputType;
      fieldValues: Record<string, any>;
      configurationValues: Record<string, any>;
    }) => {
      const id = crypto.randomUUID();
      setFieldValues(prev => {
        return {
          ...prev,
          innerFields: [
            ...(prev.innerFields || []),
            {fieldValues: {...fieldValues, id}, configurationValues, type}
          ]
        };
      });
    },
    []
  );

  useEffect(() => {
    setFieldValues(defaultFieldValues);
  }, [type]);

  function arraysEqualIgnoreOrder(a: string[], b: string[]) {
    if (a.length !== b.length) return false;

    // Sort and compare
    const sortedA = [...a].sort();
    const sortedB = [...b].sort();

    return sortedA.every((val, i) => val === sortedB[i]);
  }

  const currentFieldValues = arraysEqualIgnoreOrder(
    Object.keys(fieldValues),
    Object.keys(defaultFieldValues)
  )
    ? fieldValues
    : defaultFieldValues;

  const inputRepresenter = useInputRepresenter({
    properties: inputProperties,
    value: currentFieldValues,
    onChange: setFieldValues,
    error: fieldErrors ?? {},
    errorClassName: styles.error
  });

  const configuration = useInputRepresenter({
    properties: configFields as unknown as Property,
    value: configurationValue,
    onChange: setConfigurationValue
  });

  const defaultInput = useInputRepresenter({
    properties: defaultProperty as unknown as Property,
    value: defaultValue,
    onChange: setDefaultValue
  });

  const presets = useInputRepresenter({
    properties: presetProperties as unknown as Property,
    value: presetValues,
    onChange: setPresetValues
  });

  const tabs = useMemo(() => {
    const items = [];

    if (isInnerFieldsType) {
      const index = items.length;
      items.push({
        prefix: {children: "Inner Fields", onClick: () => setActiveTab(index)},
        element: (
          <div>
            {fieldValues.innerFields?.map?.((field: FieldType, i: number) => (
              <InnerField
                key={i}
                field={field}
                buckets={buckets}
                bucket={bucket as BucketType}
                setFieldValues={setFieldValues}
              />
            ))}
          </div>
        )
      });
    }

    if (type === "string" || fieldValues.arrayType === "string") {
      const index = items.length;
      items.push({
        prefix: {children: "Presets", onClick: () => setActiveTab(index)},
        element: <div className={styles.presetsContainer}>{presets}</div>
      });
    }

    if (
      ![
        "textarea",
        "multiselect",
        "relation",
        "location",
        "storage",
        "richtext",
        "array",
        "object"
      ].includes(type)
    ) {
      const index = items.length;
      items.push({
        prefix: {children: "Default", onClick: () => setActiveTab(index)},
        element: defaultInput
      });
    }

    const index = items.length;
    items.push({
      prefix: {children: "Configuration", onClick: () => setActiveTab(index)},
      element: <div className={styles.configurationOptionsContainer}>{configuration}</div>
    });

    return items;
  }, [
    type,
    isInnerFieldsType,
    fieldValues.innerFields,
    presets,
    defaultInput,
    configuration,
    buckets,
    bucket
  ]);

  const tabItems = useMemo(() => tabs.map(i => ({prefix: i.prefix})), [tabs]);

  return (
    <BucketAddField_
      className={className}
      title={title}
      inputRepresenter={inputRepresenter as unknown as ReactHTMLElement<any>}
      tabItems={tabItems}
      tabs={
        tabs as unknown as {
          prefix: {children: string; onClick: () => void};
          element: ReactHTMLElement<any>;
        }[]
      }
      activeTab={activeTab}
      handleSaveAndClose={handleSaveAndClose}
      isLoading={isLoading}
      isInnerFieldsType={isInnerFieldsType}
      handleCreateInnerField={handleCreateInnerField}
      buckets={buckets}
      bucket={bucket}
      apiError={apiError}
      innerFieldStyles={innerFieldStyles}
    />
  );
};

function BucketAddField_({
  className,
  title,
  inputRepresenter,
  tabItems,
  tabs,
  activeTab,
  handleSaveAndClose,
  isLoading,
  isInnerFieldsType,
  handleCreateInnerField,
  buckets,
  bucket,
  apiError,
  innerFieldStyles
}: {
  className?: string;
  title?: {text: string; icon: string};
  inputRepresenter: ReactHTMLElement<any>;
  tabItems: {prefix: {children: string; onClick: () => void}}[];
  tabs: {prefix: {children: string; onClick: () => void}; element: ReactHTMLElement<any>}[];
  activeTab: number;
  handleSaveAndClose: () => void;
  isLoading: boolean;
  isInnerFieldsType: boolean;
  handleCreateInnerField: (arg: {
    type: TypeInputType;
    fieldValues: Record<string, any>;
    configurationValues: Record<string, any>;
  }) => void;
  buckets: BucketType[];
  bucket?: BucketType;
  apiError: string | null;
  innerFieldStyles?: CSSProperties;
}) {
  return (
    <FlexElement
      direction="vertical"
      gap={10}
      className={`${styles.contentContainer} ${className || ""}`}
    >
      <FluidContainer
        key={title?.text}
        dimensionX="fill"
        dimensionY="hug"
        alignment="leftCenter"
        className={styles.item}
        root={{
          children: (
            <Text dimensionX="fill" className={styles.displayer}>
              {title?.text}
            </Text>
          ),
          dimensionX: "fill"
        }}
        gap={10}
        prefix={{children: <Icon name={title?.icon as IconName} />}}
      />
      {inputRepresenter}
      <Tab
        type="underline"
        indicatorMode={tabItems.length > 2 ? "equal" : "fit"}
        dimensionX="fill"
        items={tabItems}
        className={`${styles.tab} ${tabItems.length > 2 ? styles.bigTab : styles.smallTab}`}
      />

      {tabs[activeTab].element as ReactHTMLElement<any>}

      <div className={styles.buttonWrapper}>
        <Button
          className={styles.saveAndCloseButton}
          onClick={handleSaveAndClose}
          loading={isLoading}
          disabled={isLoading}
        >
          <FluidContainer
            prefix={{children: <Icon name="save" size="sm" />}}
            root={{children: "Save and close"}}
          />
        </Button>
        {isInnerFieldsType && (
          <BucketFieldPopup
            buckets={buckets}
            bucket={bucket as BucketType}
            onSaveAndClose={handleCreateInnerField as TypeSaveFieldHandler}
            bucketAddFieldPopoverStyles={innerFieldStyles}
          >
            <Button color="default" variant="dashed" className={styles.buttonInnerFields}>
              <FluidContainer
                prefix={{children: <Icon name="plus" size="sm" />}}
                root={{children: "Add New Inner Field"}}
              />
            </Button>
          </BucketFieldPopup>
        )}
      </div>
      {apiError && (
        <div className={isInnerFieldsType ? styles.innerFieldsError : styles.defaultError}>
          <div className={styles.errorTextContainer}>
            <Text className={styles.errorText} variant="danger">
              {apiError}
            </Text>
          </div>
        </div>
      )}
    </FlexElement>
  );
}

export default memo(BucketAddField);
