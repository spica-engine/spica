import {type FC, memo, useMemo, useState, useCallback} from "react";
import {configurationMapping, createShema} from "./BucketAddFieldSchema";
import {
  Button,
  FlexElement,
  FluidContainer,
  Icon,
  Modal,
  Tab,
  type TypeModal,
  Text
} from "oziko-ui-kit";
import styles from "./BucketAddField.module.scss";
import useInputRepresenter from "../../../hooks/useInputRepresenter";
import type {BucketType, Property} from "src/services/bucketService";
import useStringPresetsSync from "./useStringPresetsSync";
import BucketFieldPopup from "../../../components/atoms/bucket-field-popup/BucketFieldPopup";
import {createFieldProperty} from "./utils";
import type {EditInnerFieldProps, TypeBucketAddField, TypeBucketFieldCreator} from "./types";

const DEFAULT_VALUES = {
  string: "",
  textarea: "",
  boolean: false,
  multiselect: [],
  select: "",
  chip: []
};

const getDefaultValues = (
  schema: Record<string, {type: string}>,
  initial?: Record<string, any>,
  extraDefaults: Record<string, any> = {}
) =>
  initial ?? {
    ...extraDefaults,
    ...Object.fromEntries(
      Object.keys(schema).map(key => [
        key,
        DEFAULT_VALUES[schema[key].type as keyof typeof DEFAULT_VALUES]
      ])
    )
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
  const configurationSchema = useMemo(() => configurationMapping[type] || {}, [type]);
  const schema = useMemo(() => createShema[type] || {}, [type]);
  const schemaWithDynamicTitle = useMemo(
    () => ({...schema, title: {...schema.title, title: name}}),
    [schema, name]
  );

  const [fieldValues, setFieldValues] = useState<Record<string, any>>(() =>
    getDefaultValues(schema, initialValues?.fieldValues, {
      title: name,
      description: ""
    })
  );

  const [configurationValue, setConfigurationValue] = useState<Record<string, any>>(() =>
    getDefaultValues(configurationSchema, initialValues?.configurationValue)
  );

  const inputProperties = useMemo(
    () => ({
      ...schemaWithDynamicTitle,
      ...(type === "relation" && {
        buckets: {
          ...schemaWithDynamicTitle.buckets,
          enum: buckets.map(b => b.title)
        }
      })
    }),
    [type, schemaWithDynamicTitle, buckets]
  );

  const inputRepresenter = useInputRepresenter({
    properties: inputProperties,
    value: fieldValues,
    onChange: setFieldValues
  });

  const configuration = useInputRepresenter({
    properties: configurationSchema,
    value: configurationValue,
    onChange: setConfigurationValue
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
          onSaveAndClose={onSaveAndClose}
          handleClose={modalProps?.onClose as () => void}
        />
      </Modal.Body>
    </Modal>
  );
};

export default memo(BucketAddField);

const makeTab = (label: string, onClick: () => void) => ({
  prefix: {children: label, onClick}
});

const BucketFieldCreator: FC<TypeBucketFieldCreator> = memo(
  ({
    type,
    fieldValues,
    setFieldValues,
    configurationValue,
    inputRepresenter,
    configuration,
    onSaveAndClose,
    handleClose,
    bucket,
    buckets
  }) => {
    const isInnerFieldsType = useMemo(
      () => type === "array" && fieldValues.arrayType === "object",
      [type, fieldValues.arrayType]
    );

    const [activeTab, setActiveTab] = useState(() => (isInnerFieldsType ? 0 : 1));

    const tabItems = useMemo(() => {
      const items = [];
      if (isInnerFieldsType) {
        items.push(makeTab("Inner Fields", () => setActiveTab(0)));
      }

      items.push(
        makeTab("Default", () => setActiveTab(1)),
        makeTab("Configuration", () => setActiveTab(2))
      );

      return items;
    }, [isInnerFieldsType]);

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

type InnerFieldProps = {
  field: Property;
  bucket?: BucketType;
  buckets: BucketType[];
  setFieldValues: React.Dispatch<React.SetStateAction<Record<string, any>>>;
};

const InnerField = ({field, bucket, buckets, setFieldValues}: InnerFieldProps) => {
  const handleSaveInnerField = useCallback((fieldProperty: Property) => {
    setFieldValues(prev => ({
      ...prev,
      innerFields: prev.innerFields?.map((innerField: any) =>
        innerField.title === fieldProperty.title ? fieldProperty : innerField
      )
    }));
  }, []);

  const handleDeleteInnerField = useCallback((field: Property) => {
    setFieldValues(prev => ({
      ...prev,
      innerFields: prev.innerFields?.filter((innerField: any) => innerField.title !== field.title)
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
            <Button color="danger" variant="icon" onClick={() => handleDeleteInnerField(field)}>
              <Icon name="delete" />
            </Button>
          </FlexElement>
        )
      }}
    />
  );
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
