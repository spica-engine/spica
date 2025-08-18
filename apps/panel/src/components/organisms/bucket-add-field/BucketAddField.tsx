import {type FC, memo, useMemo, useState, useCallback, type JSX, type ReactNode} from "react";
import {configurationMapping, createShema} from "./BucketAddFieldSchema";
import {
  Button,
  FlexElement,
  FluidContainer,
  Icon,
  Modal,
  Tab,
  type TypeInputType,
  type TypeModal
} from "oziko-ui-kit";
import styles from "./BucketAddField.module.scss";
import useInputRepresenter from "../../../hooks/useInputRepresenter";
import {useBucket} from "../../../contexts/BucketContext";
import type {BucketType, Property} from "src/services/bucketService";
import useStringPresetsSync from "./useStringPresetsSync";

type TypeBucketAddField = {name: string; type: TypeInputType; modalProps?: TypeModal};

const DEFAULT_VALUES = {
  string: "",
  textarea: "",
  boolean: false,
  multiselect: [],
  chip: []
};

const BucketAddField: FC<TypeBucketAddField> = ({name = "", type, modalProps}) => {
  const isInnerFieldsType = useMemo(() => ["object", "array"].includes(type), [type]);
  const [activeTab, setActiveTab] = useState(() => (isInnerFieldsType ? 0 : 1));

  const configurationSchema = useMemo(() => configurationMapping[type] || {}, [type]);
  const schema = useMemo(() => createShema[type] || {}, [type]);
  const schemaWithDynamicTitle = useMemo(
    () => ({...schema, title: {...schema.title, title: name}}),
    [schema, name]
  );

  const tabItems = useMemo(
    () => [
      ...(isInnerFieldsType
        ? [
            {
              prefix: {
                children: "Inner Fields",
                onClick: () => setActiveTab(0)
              }
            }
          ]
        : []),
      {
        prefix: {
          children: "Default",
          onClick: () => setActiveTab(1)
        }
      },
      {
        prefix: {
          children: "Configuration",
          onClick: () => setActiveTab(2)
        }
      }
    ],
    [isInnerFieldsType]
  );

  const {bucketData, buckets} = useBucket();

  const [fieldValues, setFieldValues] = useState<Record<string, any>>(() => ({
    title: name,
    description: "",
    ...Object.fromEntries(
      Object.keys(schema).map(key => [
        key,
        DEFAULT_VALUES[schema[key].type as keyof typeof DEFAULT_VALUES]
      ])
    )
  }));

  const [configurationValue, setConfigurationValue] = useState(() =>
    Object.fromEntries(
      Object.keys(configurationSchema).map(key => [
        key,
        DEFAULT_VALUES[configurationSchema[key].type as keyof typeof DEFAULT_VALUES]
      ])
    )
  );

  const inputRepresenter = useInputRepresenter({
    properties: schemaWithDynamicTitle,
    value: fieldValues,
    onChange: setFieldValues
  });

  const configuration = useInputRepresenter({
    properties: configurationSchema,
    value: configurationValue,
    onChange: val => {
      setConfigurationValue(val);
    }
  });

  useStringPresetsSync({type, fieldValues, setFieldValues});

  const bucket = useMemo(
    () => buckets.find(i => i._id === bucketData?.bucketId),
    [buckets, bucketData?.bucketId]
  );

  return (
    <Modal isOpen overflow={true} showCloseButton={false} {...modalProps} className={styles.modal}>
      <Modal.Body className={styles.modalBody}>
        <BucketFieldCreator
          type={type}
          fieldValues={fieldValues}
          configurationValue={configurationValue}
          bucket={bucket}
          inputRepresenter={inputRepresenter}
          configuration={configuration}
          activeTab={activeTab}
          tabItems={tabItems}
          isInnerFieldsType={isInnerFieldsType}
        />
      </Modal.Body>
    </Modal>
  );
};

export default memo(BucketAddField);

type TypeBucketFieldCreator = {
  type: TypeInputType;
  fieldValues: Record<string, any>;
  configurationValue: Record<string, any>;
  bucket?: BucketType;
  inputRepresenter: ReactNode;
  configuration: ReactNode;
  activeTab: number;
  tabItems: any[];
  isInnerFieldsType: boolean;
};

const createFieldProperty = (
  type: TypeInputType,
  fieldValues: Record<string, any>,
  configurationValue: Record<string, any>
): Property => {
  const baseProperty = {
    type,
    title: fieldValues.title,
    description: fieldValues.description,
    options: {
      position: "bottom",
      index: configurationValue.index
    }
  } as Property;

  // Type-specific configurations
  switch (type) {
    case "string":
      return {
        ...baseProperty,
        options: {...baseProperty.options, translate: configurationValue.translate},
        pattern: fieldValues.regularExpression,
        enum:
          (fieldValues.enumeratedValues as string[])?.length > 0
            ? (fieldValues.enumeratedValues as string[])
            : undefined,
        default: fieldValues.default
      };

    case "number":
      return {
        ...baseProperty,
        minimum: fieldValues.minimum,
        maximum: fieldValues.maximum,
        enum:
          (configurationValue.enumeratedValues as string[])?.length > 0
            ? (configurationValue.enumeratedValues as string[])
            : undefined,
        default: fieldValues.default
      };

    case "date":
    case "boolean":
      return {
        ...baseProperty,
        readOnly: configurationValue.readOnly,
        default: fieldValues.default
      };

    case "color":
      return {
        ...baseProperty,
        readOnly: configurationValue.readOnly
      };

    case "textarea":
      return {
        ...baseProperty,
        options: {...baseProperty.options, translate: configurationValue.translate},
        readOnly: configurationValue.readOnly,
        default: fieldValues.default
      };

    case "multiselect":
      return {
        ...baseProperty,
        items: {
          type: fieldValues.multipleSelectionType,
          enum: fieldValues.chip
        },
        maxItems: fieldValues.maxItems
      };

    case "location":
      return {
        ...baseProperty,
        locationType: "Point",
        readOnly: configurationValue.readOnly
      };

    case "array":
      return {
        ...baseProperty,
        options: {...baseProperty.options, translate: configurationValue.translate},
        pattern: fieldValues.regularExpression,
        enum:
          (fieldValues.enumeratedValues as string[])?.length > 0
            ? (fieldValues.enumeratedValues as string[])
            : undefined,
        default: fieldValues.default,
        maxItems: fieldValues.maxItems,
        minItems: fieldValues.minItems,
        uniqueItems: fieldValues.uniqueItems
      };

    case "object":
    case "storage":
    case "richtext":
      return {
        ...baseProperty,
        options: {...baseProperty.options, translate: configurationValue.translate},
        readOnly: configurationValue.readOnly
      };

    default:
      return baseProperty;
  }
};

const BucketFieldCreator: FC<TypeBucketFieldCreator> = memo(
  ({
    type,
    fieldValues,
    configurationValue,
    bucket,
    inputRepresenter,
    configuration,
    activeTab,
    tabItems,
    isInnerFieldsType
  }) => {
    const {createBucketField} = useBucket();

    const fieldProperty = useMemo(
      () => createFieldProperty(type, fieldValues, configurationValue),
      [type, fieldValues, configurationValue]
    );

    const requiredField = useMemo(
      () => (configurationValue.requiredField ? fieldValues.title : undefined),
      [configurationValue.requiredField, fieldValues.title]
    );

    const handleSaveAndClose = useCallback(() => {
      if (!bucket) return;
      createBucketField(bucket, fieldProperty, requiredField);
    }, [bucket, fieldProperty, requiredField, createBucketField]);

    return (
      <FlexElement direction="vertical" gap={10} className={styles.contentContainer}>
        {inputRepresenter}
        <Tab
          type="underline"
          indicatorMode={isInnerFieldsType ? "equal" : "fit"}
          dimensionX="fill"
          items={tabItems}
          className={`${styles.tab} ${isInnerFieldsType ? styles.bigTab : styles.smallTab}`}
        />
        {activeTab === 2 && configuration}
        <div className={styles.buttonWrapper}>
          <Button className={styles.saveAndCloseButton} onClick={handleSaveAndClose}>
            <FluidContainer
              prefix={{children: <Icon name="save" size="sm" />}}
              root={{children: "Save and close"}}
            />
          </Button>
          {isInnerFieldsType && (
            <Button color="default" variant="dashed" className={styles.buttonInnerFields}>
              <FluidContainer
                prefix={{children: <Icon name="plus" size="sm" />}}
                root={{children: "Add New Inner Field"}}
              />
            </Button>
          )}
        </div>
      </FlexElement>
    );
  }
);
