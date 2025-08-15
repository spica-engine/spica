import {type FC, memo, useState} from "react";
import {createShema} from "./BucketAddFieldSchema";
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
import useStringAndArrayPresetsSync from "./use-string-and-array-presets-sync";

type TypeBucketAddField = {name: string; type: TypeInputType; modalProps?: TypeModal};

const defaultValues = {
  string: "",
  textarea: "",
  boolean: false,
  multiselect: [],
  chip: []
};

const BucketAddField: FC<TypeBucketAddField> = ({name = "", type, modalProps}) => {
  const isInnerFieldsType = ["object", "array"].includes(type);
  const initialTab = isInnerFieldsType ? 0 : 1;
  const [activeTab, setActiveTab] = useState(initialTab);
  const configurationMapping = {
    string: createShema.stringConfiguration,
    number: createShema.numberConfiguration,
    date: createShema.configurationType1,
    color: createShema.configurationType1,
    multiselect: createShema.configurationType1,
    object: createShema.configurationType2,
    storage: createShema.configurationType2,
    richtext: createShema.configurationType2,
    textarea: createShema.configurationTextarea,
    boolean: createShema.configurationBoolean,
    location: createShema.configurationLocation,
    array: createShema.configurationArray
  };

  const configurationSchema = configurationMapping[type] || {};
  const schema = createShema[type] || {};
  const schemaWithDynamicTitle = {...schema, title: {...schema.title, title: name}};

  const {createBucketField, bucketData, buckets} = useBucket();

  const [fieldValues, setFieldValues] = useState<Record<string, any>>({
    title: name,
    description: "",
    ...Object.fromEntries(
      Object.keys(schema).map(key => [
        key,
        defaultValues[schema[key].type as keyof typeof defaultValues]
      ])
    )
  });

  const [configurationValue, setConfigurationValue] = useState(
    Object.fromEntries(
      Object.keys(configurationSchema).map(key => [
        key,
        defaultValues[configurationSchema[key].type as keyof typeof defaultValues]
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

  useStringAndArrayPresetsSync({type, fieldValues, setFieldValues});

  const tabItems = [
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
  ];

  const createStringField = (bucket: BucketType, requiredField?: string) => {
    createBucketField(
      bucket,
      {
        type,
        title: fieldValues.title,
        description: fieldValues.description,
        options: {
          position: "bottom",
          index: configurationValue.index,
          translate: configurationValue.translate
        },
        pattern: fieldValues.regularExpression,
        enum:
          (fieldValues.enumeratedValues as string[]).length > 0
            ? (fieldValues.enumeratedValues as string[])
            : undefined,
        default: fieldValues.default
      } as Property,
      requiredField
    );
  };

  const createNumberField = (bucket: BucketType, requiredField?: string) => {
    createBucketField(
      bucket,
      {
        type,
        title: fieldValues.title,
        description: fieldValues.description,
        options: {
          position: "bottom",
          index: configurationValue.index
        },
        minimum: fieldValues.minimum,
        maximum: fieldValues.maximum,
        enum:
          (configurationValue.enumeratedValues as string[]).length > 0
            ? (configurationValue.enumeratedValues as string[])
            : undefined,
        default: fieldValues.default
      } as Property,
      requiredField
    );
  };

  const createDateField = (bucket: BucketType, requiredField?: string) => {
    createBucketField(
      bucket,
      {
        type,
        title: fieldValues.title,
        description: fieldValues.description,
        options: {
          position: "bottom",
          index: configurationValue.index
        },
        readOnly: configurationValue.readOnly,
        default: fieldValues.default
      } as Property,
      requiredField
    );
  };

  const createColorField = (bucket: BucketType, requiredField?: string) => {
    createBucketField(
      bucket,
      {
        type,
        title: fieldValues.title,
        description: fieldValues.description,
        options: {
          position: "bottom",
          index: configurationValue.index
        },
        readOnly: configurationValue.readOnly
      } as Property,
      requiredField
    );
  };

  const createBooleanField = (bucket: BucketType, requiredField?: string) => {
    createBucketField(
      bucket,
      {
        type,
        title: fieldValues.title,
        description: fieldValues.description,
        options: {
          position: "bottom",
          index: configurationValue.index
        },
        readOnly: configurationValue.readOnly,
        default: fieldValues.default
      } as Property,
      requiredField
    );
  };

  const createTextAreaField = (bucket: BucketType, requiredField?: string) => {
    createBucketField(
      bucket,
      {
        type,
        title: fieldValues.title,
        description: fieldValues.description,
        options: {
          position: "bottom",
          index: configurationValue.index,
          translate: configurationValue.translate
        },
        readOnly: configurationValue.readOnly,
        default: fieldValues.default
      } as Property,
      requiredField
    );
  };

  const createMultiSelectField = (bucket: BucketType, requiredField?: string) => {
    createBucketField(
      bucket,
      {
        type,
        title: fieldValues.title,
        description: fieldValues.description,
        options: {
          position: "bottom",
          index: configurationValue.index
        },
        items: {
          type: fieldValues.multipleSelectionType,
          enum: fieldValues.chip
        },
        maxItems: fieldValues.maxItems
      } as Property,
      requiredField
    );
  };

  //const createRelationField = () => ...

  const createLocationField = (bucket: BucketType, requiredField?: string) => {
    createBucketField(
      bucket,
      {
        type,
        title: fieldValues.title,
        description: fieldValues.description,
        locationType: "Point",
        options: {
          position: "bottom"
        },
        readOnly: configurationValue.readOnly
      } as Property,
      requiredField
    );
  };

  const createArrayField = (bucket: BucketType, requiredField?: string) => {
    createBucketField(
      bucket,
      {
        type,
        title: fieldValues.title,
        description: fieldValues.description,
        options: {
          position: "bottom",
          index: configurationValue.index,
          translate: configurationValue.translate
        },
        pattern: fieldValues.regularExpression,
        enum:
          (fieldValues.enumeratedValues as string[]).length > 0
            ? (fieldValues.enumeratedValues as string[])
            : undefined,
        default: fieldValues.default,
        maxItems: fieldValues.maxItems,
        minItems: fieldValues.minItems,
        uniqueItems: fieldValues.uniqueItems
      } as Property,
      requiredField
    );
  };

  const createObjectField = (bucket: BucketType, requiredField?: string) => {
    createBucketField(
      bucket,
      {
        type,
        title: fieldValues.title,
        description: fieldValues.description,
        options: {
          position: "bottom",
          index: configurationValue.index,
          translate: configurationValue.translate
        },
        readOnly: configurationValue.readOnly
      } as Property,
      requiredField
    );
  };

  const createFileField = (bucket: BucketType, requiredField?: string) => {
    createBucketField(
      bucket,
      {
        type,
        title: fieldValues.title,
        description: fieldValues.description,
        options: {
          position: "bottom",
          index: configurationValue.index,
          translate: configurationValue.translate
        },
        readOnly: configurationValue.readOnly
      } as Property,
      requiredField
    );
  };

  const createRichTextField = (bucket: BucketType, requiredField?: string) => {
    createBucketField(
      bucket,
      {
        type,
        title: fieldValues.title,
        description: fieldValues.description,
        options: {
          position: "bottom",
          index: configurationValue.index,
          translate: configurationValue.translate
        },
        readOnly: configurationValue.readOnly
      } as Property,
      requiredField
    );
  };

  const createFieldMap = {
    string: createStringField,
    number: createNumberField,
    date: createDateField,
    color: createColorField,
    boolean: createBooleanField,
    textarea: createTextAreaField,
    multiselect: createMultiSelectField,
    //relation: createRelationField,
    location: createLocationField,
    array: createArrayField,
    object: createObjectField,
    storage: createFileField,
    richtext: createRichTextField
  };

  const handleSaveAndClose = () => {
    const bucket = buckets.find(i => i._id === bucketData?.bucketId);
    if (!bucket) return;
    const requiredField = configurationValue.requiredField ? fieldValues.title : undefined;
    createFieldMap[type](bucket, requiredField);
  };

  return (
    <Modal isOpen overflow={true} showCloseButton={false} {...modalProps} className={styles.modal}>
      <Modal.Body className={styles.modalBody}>
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
      </Modal.Body>
    </Modal>
  );
};

export default memo(BucketAddField);
