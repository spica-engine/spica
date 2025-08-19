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
  type TypeModal,
  Text
} from "oziko-ui-kit";
import styles from "./BucketAddField.module.scss";
import useInputRepresenter from "../../../hooks/useInputRepresenter";
import type {BucketType, Property} from "src/services/bucketService";
import useStringPresetsSync from "./useStringPresetsSync";
import BucketFieldPopup from "../../../components/atoms/bucket-field-popup/BucketFieldPopup";

type TypeBucketAddField = {
  name: string;
  type: TypeInputType | "relation";
  modalProps?: TypeModal;
  onSaveAndClose: (fieldProperty: Property, requiredField?: string) => void | Promise<void>;
  bucket: BucketType;
  buckets: BucketType[];
  initialValues?: {
    fieldValues?: Record<string, any>;
    configurationValue?: Record<string, any>;
  };
};

type TypeBucketFieldCreator = {
  type: TypeInputType | "relation";
  fieldValues: Record<string, any>;
  setFieldValues: React.Dispatch<React.SetStateAction<Record<string, any>>>;
  configurationValue: Record<string, any>;
  bucket?: BucketType;
  buckets: BucketType[];
  inputRepresenter: ReactNode;
  configuration: ReactNode;
  activeTab: number;
  tabItems: any[];
  isInnerFieldsType: boolean;
  onSaveAndClose: (fieldProperty: Property, requiredField?: string) => void | Promise<void>;
  handleClose: () => void;
};

const createFieldProperty = (
  type: TypeInputType | "relation",
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
        uniqueItems: fieldValues.uniqueItems,
        items: {
          type: fieldValues.arrayType,
          title: fieldValues.arrayItemTitle,
          description: fieldValues.arrayItemDescription,
          properties: fieldValues.innerFields?.map((field: Property) =>
            createFieldProperty(field.type, field, {})
          )
        }
      };

    case "object":
    case "storage":
    case "richtext":
      return {
        ...baseProperty,
        options: {...baseProperty.options, translate: configurationValue.translate},
        readOnly: configurationValue.readOnly
      };
    case "relation":
      return baseProperty;
    default:
      return baseProperty;
  }
};

const DEFAULT_VALUES = {
  string: "",
  textarea: "",
  boolean: false,
  multiselect: [],
  select: "",
  chip: [],
  arrayType: "string"
};

const BucketAddField: FC<TypeBucketAddField> = ({
  name = "",
  type,
  modalProps,
  onSaveAndClose,
  bucket,
  buckets,
  initialValues
}) => {
  const isArrayType = useMemo(() => type === "array", [type]);
  const [activeTab, setActiveTab] = useState(() => (isArrayType ? 0 : 1));

  const configurationSchema = useMemo(() => configurationMapping[type] || {}, [type]);
  const schema = useMemo(() => createShema[type] || {}, [type]);
  const schemaWithDynamicTitle = useMemo(
    () => ({...schema, title: {...schema.title, title: name}}),
    [schema, name]
  );

  const [fieldValues, setFieldValues] = useState<Record<string, any>>(
    () =>
      initialValues?.fieldValues ?? {
        title: name,
        description: "",
        ...Object.fromEntries(
          Object.keys(schema).map(key => [
            key,
            DEFAULT_VALUES[key as keyof typeof DEFAULT_VALUES] ??
              DEFAULT_VALUES[schema[key].type as keyof typeof DEFAULT_VALUES]
          ])
        )
      }
  );

  const isInnerFieldsType = useMemo(
    () => isArrayType && fieldValues.arrayType === "object",
    [type, fieldValues.arrayType]
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

  const [configurationValue, setConfigurationValue] = useState(
    () =>
      initialValues?.configurationValue ??
      Object.fromEntries(
        Object.keys(configurationSchema).map(key => [
          key,
          DEFAULT_VALUES[configurationSchema[key].type as keyof typeof DEFAULT_VALUES]
        ])
      )
  );

  const inputRepresenter = useInputRepresenter({
    properties:
      type === "relation"
        ? {
            ...schemaWithDynamicTitle,
            buckets: {
              ...schemaWithDynamicTitle.buckets,
              //enum: buckets.map(i => ({title: i.title, id: i._id}))
              enum: buckets.map(i => i.title)
            }
          }
        : schemaWithDynamicTitle,
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

  return (
    <Modal isOpen overflow={true} showCloseButton={false} {...modalProps} className={styles.modal}>
      <Modal.Body className={styles.modalBody}>
        <BucketFieldCreator
          type={type}
          fieldValues={fieldValues}
          setFieldValues={setFieldValues}
          configurationValue={configurationValue}
          bucket={bucket}
          buckets={buckets}
          inputRepresenter={inputRepresenter}
          configuration={configuration}
          activeTab={activeTab}
          tabItems={tabItems}
          isInnerFieldsType={isInnerFieldsType}
          onSaveAndClose={onSaveAndClose}
          handleClose={modalProps?.onClose as () => void}
        />
      </Modal.Body>
    </Modal>
  );
};

export default memo(BucketAddField);

const BucketFieldCreator: FC<TypeBucketFieldCreator> = memo(
  ({
    type,
    fieldValues,
    setFieldValues,
    configurationValue,
    inputRepresenter,
    configuration,
    activeTab,
    tabItems,
    isInnerFieldsType,
    onSaveAndClose,
    handleClose,
    bucket,
    buckets
  }) => {
    const fieldProperty = useMemo(
      () => createFieldProperty(type, fieldValues, configurationValue),
      [type, fieldValues, configurationValue]
    );

    const requiredField = useMemo(
      () => (configurationValue.requiredField ? fieldValues.title : undefined),
      [configurationValue.requiredField, fieldValues.title]
    );

    const handleSaveAndClose = useCallback(async () => {
      await onSaveAndClose(fieldProperty, requiredField);
      handleClose();
    }, [fieldProperty, requiredField, onSaveAndClose]);

    const handleCreateInnerField = useCallback((fieldProperty: Property) => {
      setFieldValues(prev => ({
        ...prev,
        innerFields: [...(prev.innerFields || []), fieldProperty]
      }));
    }, []);

    const handleSaveInnerField = useCallback(
      (fieldProperty: Property) => {
        setFieldValues(prev => ({
          ...prev,
          innerFields: prev.innerFields?.map((innerField: any) =>
            innerField.title === fieldProperty.title ? fieldProperty : innerField
          )
        }));
      },
      [handleCreateInnerField, onSaveAndClose]
    );

    const handleDeleteInnerField = useCallback((field: Property) => {
      setFieldValues(prev => ({
        ...prev,
        innerFields: prev.innerFields?.filter((innerField: any) => innerField.title !== field.title)
      }));
    }, []);

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
        <div className={styles.configurationOptionsContainer}>
          {activeTab === 0 && isInnerFieldsType && (
            <div className={styles.innerFieldsContainer}>
              {fieldValues.innerFields?.map?.((field: Property, index: number) => (
                <FluidContainer
                  dimensionX="fill"
                  className={styles.innerFieldItem}
                  key={index}
                  prefix={{
                    children: (
                      <FlexElement gap={5} className={styles.innerFieldPrefix}>
                        <Icon name={"chevronRight"} size="sm" />
                        <Text className={styles.innerFieldName}>{field.title}</Text>
                      </FlexElement>
                    )
                  }}
                  root={{children: <Text>{field.type}</Text>}}
                  suffix={{
                    children: (
                      <FlexElement gap={5} dimensionX="fill" className={styles.innerFieldActions}>
                        <EditInnerField
                          name={field.title}
                          type={field.type}
                          onSaveAndClose={handleSaveInnerField}
                          bucket={bucket as BucketType}
                          buckets={buckets}
                          fieldValues={field}
                        />
                        <Button
                          color="danger"
                          variant="icon"
                          onClick={() => handleDeleteInnerField(field)}
                        >
                          <Icon name="delete" />
                        </Button>
                      </FlexElement>
                    )
                  }}
                />
              ))}
            </div>
          )}
          {activeTab === 2 && configuration}
        </div>
        <div className={styles.buttonWrapper}>
          <Button className={styles.saveAndCloseButton} onClick={handleSaveAndClose}>
            <FluidContainer
              prefix={{children: <Icon name="save" size="sm" />}}
              root={{children: "Save and close"}}
            />
          </Button>
          {isInnerFieldsType && (
            <BucketFieldPopup
              buckets={buckets}
              bucket={bucket as BucketType}
              onSaveAndClose={handleCreateInnerField}
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
  }
);

type EditInnerFieldProps = {
  name: string;
  type: TypeInputType | "relation";
  onSaveAndClose: (fieldProperty: Property, requiredField?: string) => void | Promise<void>;
  bucket: BucketType;
  buckets: BucketType[];
  fieldValues?: Record<string, any>;
  configurationValue?: Record<string, any>;
};

const EditInnerField: FC<EditInnerFieldProps> = ({
  name,
  type,
  onSaveAndClose,
  bucket,
  buckets,
  fieldValues,
  configurationValue
}) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button color="default" variant="icon" onClick={() => setIsOpen(true)}>
        <Icon name="pencil" />
      </Button>
      {isOpen && (
        <BucketAddField
          name={name}
          type={type}
          onSaveAndClose={onSaveAndClose}
          bucket={bucket}
          buckets={buckets}
          initialValues={{
            fieldValues: fieldValues,
            configurationValue: configurationValue
          }}
          modalProps={{onClose: () => setIsOpen(false)} as TypeModal}
        />
      )}
    </>
  );
};
