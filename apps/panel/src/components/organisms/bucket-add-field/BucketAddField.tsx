import {type FC, memo, useMemo, useState, useCallback, type ReactNode, useEffect} from "react";
import {configurationMapping, createShema, innerConfigurationMapping} from "./BucketAddFieldSchema";
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
import type {BucketType} from "src/services/bucketService";
import useStringPresetsSync from "./useStringPresetsSync";
import BucketFieldPopup from "../../../components/atoms/bucket-field-popup/BucketFieldPopup";
import {getDefaultValues} from "./utils";
import {InnerField, type FieldType} from "./InnerField";

export type TypeSaveFieldHandler = (
  type: TypeInputType | "relation",
  fieldValues: Record<string, any>,
  configurationValues: Record<string, any>,
  requiredField?: string
) => void | Promise<void>;

type TypeBucketAddField = {
  name: string;
  type: TypeInputType | "relation";
  modalProps?: TypeModal;
  onSaveAndClose: TypeSaveFieldHandler;
  bucket: BucketType;
  buckets: BucketType[];
  initialValues?: {
    fieldValues?: Record<string, any>;
    configurationValue?: Record<string, any>;
  };
  isInnerField?: boolean;
};

export type TypeBucketFieldCreator = {
  type: TypeInputType | "relation";
  fieldValues: Record<string, any>;
  setFieldValues: React.Dispatch<React.SetStateAction<Record<string, any>>>;
  configurationValue: Record<string, any>;
  bucket: BucketType;
  buckets: BucketType[];
  inputRepresenter: ReactNode;
  configuration: ReactNode;
  onSaveAndClose: TypeSaveFieldHandler;
  handleClose: () => void;
};

const BucketAddField: FC<TypeBucketAddField> = ({
  name = "",
  type,
  modalProps,
  onSaveAndClose,
  bucket,
  buckets,
  initialValues,
  isInnerField
}) => {
  const configurationSchema = useMemo(
    () => (isInnerField ? innerConfigurationMapping[type] : configurationMapping[type]),
    [type, isInnerField]
  );
  const schema = useMemo(() => createShema[type] || {}, [type]);

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

    useEffect(() => {
      if (isInnerFieldsType) {
        setActiveTab(0);
      }
    }, [isInnerFieldsType]);

    const requiredField = useMemo(
      () => (configurationValue.requiredField ? fieldValues.title : undefined),
      [configurationValue.requiredField, fieldValues.title]
    );

    const handleSaveAndClose = useCallback(async () => {
      await onSaveAndClose(type, fieldValues, configurationValue, requiredField);
      handleClose();
    }, [fieldValues, configurationValue, requiredField, onSaveAndClose]);

    const handleCreateInnerField = useCallback(
      (
        type: TypeInputType | "relation",
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
              bucket={bucket}
              onSaveAndClose={handleCreateInnerField}
              isInnerField
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

export default memo(BucketAddField);
