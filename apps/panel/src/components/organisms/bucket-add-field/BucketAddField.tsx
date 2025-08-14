import React, {type FC, memo, useState} from "react";
import {createShema} from "./BucketAddFieldSchema";
import {
  Button,
  FlexElement,
  FluidContainer,
  Icon,
  Modal,
  Tab,
  useInputRepresenter,
  type TypeInputType,
  type TypeModal
} from "oziko-ui-kit";
import styles from "./BucketAddField.module.scss";

type TypeBucketAddField = {name: string; type: TypeInputType; modalProps?: TypeModal};

const BucketAddField: FC<TypeBucketAddField> = ({name = "", type, modalProps}) => {
  const isInnerFieldsType = ["object", "array"].includes(type);
  const initialTab = isInnerFieldsType ? 0 : 1;
  const [activeTab, setActiveTab] = useState(initialTab);
  const [configurationValue, setConfigurationValue] = useState({
    definePattern: false,
    primaryField: false,
    translatable: false,
    readonly: false,
    uniqueValues: false,
    requiredField: false,
    selectionOptions: false,
    index: false
  });
  const configurationMapping = {
    string: createShema.configuration,
    number: createShema.configuration,
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
  const inputRepresenter = useInputRepresenter({
    properties: schemaWithDynamicTitle,
    value: {
      title: name,
      description: "",
      ...Object.fromEntries(Object.keys(schema).map(key => [key, ""]))
    },
    onChange: () => {}
  });

  const configuration = useInputRepresenter({
    properties: configurationSchema,
    value: configurationValue,
    onChange: val => setConfigurationValue(val)
  });

  const tabItems = [
    ...(isInnerFieldsType
      ? [{prefix: {children: "Inner Fields", onClick: () => setActiveTab(0)}}]
      : []),
    {prefix: {children: "Default", onClick: () => setActiveTab(1)}},
    {prefix: {children: "Configuration", onClick: () => setActiveTab(2)}}
  ];

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
            <Button className={styles.saveAndCloseButton}>
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
