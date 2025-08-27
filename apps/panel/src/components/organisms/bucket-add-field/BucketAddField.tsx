import {
  type FC,
  memo,
  useMemo,
  useState,
  useCallback,
  useEffect,
  type CSSProperties,
  type ReactNode
} from "react";
import {
  Button,
  FlexElement,
  FluidContainer,
  Icon,
  Tab,
  useInputRepresenter,
  type TypeInputType,
  type TypeModal,
  Text
} from "oziko-ui-kit";
import styles from "./BucketAddField.module.scss";
import type {BucketType, Property} from "src/services/bucketService";
import BucketFieldPopup from "../../../components/atoms/bucket-field-popup/BucketFieldPopup";
import {getDefaultValues, makeTab} from "./BucketAddFieldUtils";
import {regexPresets, enumerationPresets} from "./BucketAddFieldPresets";
import {
  createShema,
  presetPropertiesMapping,
  configFields,
  defaultConfig
} from "./BucketAddFieldSchema";

type TypeSaveFieldHandler = (
  type: TypeInputType,
  fieldValues: Record<string, any>,
  configurationValues: Record<string, any>,
  requiredField?: string
) => void | Promise<any>;

type TypeBucketAddField = {
  name: string;
  type: TypeInputType;
  modalProps?: TypeModal;
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
  prefix?: ReactNode;
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

const InnerField: FC<InnerFieldProps> = ({field, bucket, buckets, setFieldValues}) => {
  const [isEditing, setIsEditing] = useState(false);

  const handleSaveInnerField = useCallback(
    (
      type: TypeInputType,
      fieldValues: Record<string, any>,
      configurationValues: Record<string, any>
    ) => {
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
                onSaveAndClose={handleSaveInnerField}
                bucket={bucket as BucketType}
                buckets={buckets}
                initialValues={{
                  fieldValues: field.fieldValues,
                  configurationValue: field.configurationValues
                }}
                modalProps={{onClose: () => setIsEditing(false)} as TypeModal}
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
};

const BucketAddField: FC<TypeBucketAddField> = ({
  name = "",
  type,
  modalProps,
  onSaveAndClose,
  bucket,
  buckets,
  initialValues,
  className,
  innerFieldStyles,
  prefix
}) => {
  const schema = useMemo(() => createShema[type] || {}, [type]);
  const presetProperties = useMemo(
    () => presetPropertiesMapping[type as keyof typeof presetPropertiesMapping] || {},
    [type]
  );
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

  const [fieldValues, setFieldValues] = useState<Record<string, any>>(() =>
    getDefaultValues(schema, initialValues?.fieldValues, {
      title: name,
      description: ""
    })
  );

  const isInnerFieldsType = useMemo(
    () => type === "array" && fieldValues.arrayType === "object",
    [type, fieldValues.arrayType]
  );

  const tabItems = useMemo(() => {
    const items = [];
    if (isInnerFieldsType) {
      items.push(makeTab("Inner Fields", () => setActiveTab(0)));
    }
    if (type === "string") {
      items.push(makeTab("Presets", () => setActiveTab(1)));
    }

    items.push(
      makeTab("Default", () => setActiveTab(2)),
      makeTab("Configuration", () => setActiveTab(3))
    );

    return items;
  }, [isInnerFieldsType]);

  const [configurationValue, setConfigurationValue] = useState<Record<string, any>>(() =>
    getDefaultValues(configFields, initialValues?.configurationValue)
  );

  const requiredField = useMemo(
    () => (configurationValue.requiredField ? fieldValues.title : undefined),
    [configurationValue.requiredField, fieldValues.title]
  );

  const [presetValues, setPresetValues] = useState<Record<string, any>>(() =>
    getDefaultValues(presetProperties, initialValues?.presetProperteis)
  );

  const [defaultValue, setDefaultValue] = useState<Record<string, any>>(() =>
    getDefaultValues(defaultProperty)
  );
  const [fieldErrors, setFieldErrors] = useState<Record<string, string> | null>(null);
  const [activeTab, setActiveTab] = useState(() => (isInnerFieldsType ? 0 : 1));
  const [isLoading, setIsLoading] = useState(false);

  const inputRepresenter = useInputRepresenter({
    properties: inputProperties,
    value: fieldValues,
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

  useEffect(() => {
    if (type !== "string" || !presetValues.preset) return;
    const presetKey = presetValues.preset;
    if (presetKey in enumerationPresets) {
      const enumValues = enumerationPresets[presetKey as keyof typeof enumerationPresets];
      setPresetValues(prev => ({
        ...prev,
        enumeratedValues: enumValues as never[],
        regularExpression: undefined,
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
  }, [type, presetValues.preset]);

  const validateInputs = useCallback(() => {
    const errors: Record<string, string> = {};
    Object.entries(schema).forEach(([key, value]) => {
      if (key === "title" && fieldValues[key] !== fieldValues[key].toLowerCase()) {
        errors[key] = "Name must be in lowercase";
      }
      if ((value as {required: boolean}).required && !fieldValues[key]) {
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

  useEffect(() => {
    if (isInnerFieldsType) {
      setActiveTab(0);
    } else if (type === "string") {
      setActiveTab(1);
    } else {
      setActiveTab(2);
    }
  }, [isInnerFieldsType, type]);

  const handleSaveAndClose = useCallback(async () => {
    const isValid = validateInputs();
    if (!isValid) return;
    setIsLoading(true);
    const result = await onSaveAndClose(type, fieldValues, configurationValue, requiredField);
    setIsLoading(false);
    if (result) modalProps?.onClose?.();
  }, [fieldValues, configurationValue, requiredField, onSaveAndClose]);

  const handleCreateInnerField = useCallback(
    (
      type: TypeInputType,
      fieldValues: Record<string, any>,
      configurationValues: Record<string, any>
    ) => {
      const id = crypto.randomUUID();
      setFieldValues(prev => ({
        ...prev,
        innerFields: [
          ...(prev.innerFields || []),
          {fieldValues: {...fieldValues, id}, configurationValues, type}
        ]
      }));
    },
    []
  );

  return (
    <FlexElement
      direction="vertical"
      gap={10}
      className={`${styles.contentContainer} ${className || ""}`}
    >
      {prefix}
      {inputRepresenter}
      <Tab
        type="underline"
        indicatorMode={isInnerFieldsType ? "equal" : "fit"}
        dimensionX="fill"
        items={tabItems}
        className={`${styles.tab} ${isInnerFieldsType ? styles.bigTab : styles.smallTab}`}
      />

      {activeTab === 0 && isInnerFieldsType && (
        <div>
          {fieldValues.innerFields?.map?.((field: FieldType, index: number) => (
            <InnerField
              key={index}
              field={field}
              buckets={buckets}
              bucket={bucket as BucketType}
              setFieldValues={setFieldValues}
            />
          ))}
        </div>
      )}
      {activeTab === 1 && type === "string" && (
        <div className={styles.presetsContainer}>{presets}</div>
      )}
      {activeTab === 2 && defaultInput}
      {activeTab === 3 && (
        <div className={styles.configurationOptionsContainer}>{configuration}</div>
      )}
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
            bucket={bucket}
            onSaveAndClose={handleCreateInnerField}
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
    </FlexElement>
  );
};

export default memo(BucketAddField);
