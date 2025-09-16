import {
  Text,
  Button,
  FlexElement,
  FluidContainer,
  Icon,
  Tab,
  type IconName,
  type TypeFlexElement,
  type TypeFluidContainer
} from "oziko-ui-kit";
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FC,
  type JSX,
  type ReactNode
} from "react";
import type {FormErrors} from "./BucketAddFieldBusiness";
import styles from "./BucketAddField.module.scss";
import BucketFieldPopup from "../../molecules/bucket-field-popup/BucketFieldPopup";
import BucketFieldConfigurationPopup from "../../molecules/bucket-field-popup/BucketFieldConfigurationPopup";
import {
  useBucketFieldPopups,
  type PopupType
} from "../../../components/molecules/bucket-field-popup/BucketFieldPopupsContext";
import {useInputRepresenter} from "oziko-ui-kit";
import {FIELD_REGISTRY} from "../../../domain/fields/registry";
import type {TypeProperties} from "oziko-ui-kit/dist/custom-hooks/useInputRepresenter";
import type {FieldFormState, FieldKind} from "src/domain/fields/types";

type InnerFieldProps = {
  field: FieldFormState;
  onSaveInnerField: (values: FieldFormState) => void;
  onDeleteInnerField: (field: FieldFormState) => void;
};

const InnerField: FC<InnerFieldProps> = memo(({field, onSaveInnerField, onDeleteInnerField}) => {
  const [isEditing, setIsEditing] = useState(false);

  const handleToggleEdit = () => setIsEditing(prev => !prev);

  const handleSave = useCallback(
    (values: FieldFormState) => {
      onSaveInnerField({...values, id: field.id});
      handleToggleEdit();
    },
    [onSaveInnerField]
  );

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
            <BucketFieldConfigurationPopup
              isOpen={isEditing}
              selectedType={field.type}
              onClose={handleToggleEdit}
              onSaveAndClose={handleSave}
              initialValues={field as FieldFormState}
              popupType="edit-inner-field"
            >
              <Button color="default" variant="icon" onClick={handleToggleEdit}>
                <Icon name="pencil" />
              </Button>
            </BucketFieldConfigurationPopup>
            <Button color="danger" variant="icon" onClick={() => onDeleteInnerField(field)}>
              <Icon name="delete" />
            </Button>
          </FlexElement>
        )
      }}
    />
  );
});

type BucketAddFieldViewProps = {
  // Display props
  className?: string;

  // Form data
  formValues: FieldFormState;
  formErrors: FormErrors;
  error: string | null;

  // Schema and configuration
  mainFormInputProperties: TypeProperties;
  configurationInputProperties: TypeProperties;
  defaultInputProperty?: TypeProperties[keyof TypeProperties];
  presetInputProperties?: TypeProperties;

  // State
  isLoading: boolean;

  // Event handlers
  handleFormValueChange: (
    values: FieldFormState,
    formValuesAttribute: keyof FieldFormState
  ) => void;
  handleSaveAndClose: () => void;
  handleCreateInnerField: (values: FieldFormState) => void;
  handleSaveInnerField: (values: FieldFormState) => void;
  handleDeleteInnerField: (values: FieldFormState) => void;

  // External dependencies
  popupId?: string;
  type: FieldKind;
};

const BucketAddFieldView: FC<BucketAddFieldViewProps> = ({
  className,
  formValues,
  formErrors,
  error,
  mainFormInputProperties,
  configurationInputProperties,
  defaultInputProperty,
  presetInputProperties,
  isLoading,
  handleFormValueChange,
  handleSaveAndClose,
  handleCreateInnerField,
  handleSaveInnerField,
  handleDeleteInnerField,
  popupId,
  type
}) => {
  const {bucketFieldPopups} = useBucketFieldPopups();
  const {popupType} = bucketFieldPopups.find(p => p.id === popupId) as {popupType: PopupType};

  const iconsMap: Record<Exclude<PopupType, "add-field">, IconName> = {
    "edit-inner-field": "pencil",
    "add-inner-field": "plus"
  };

  const iconName = iconsMap[popupType as keyof typeof iconsMap];

  const innerFieldExists = useMemo(
    () =>
      FIELD_REGISTRY[type as keyof typeof FIELD_REGISTRY]?.requiresInnerFields?.(formValues) ??
      false,
    [type, formValues.fieldValues]
  );

  const [activeTab, setActiveTab] = useState(0);

  const mainFormInputs = useInputRepresenter({
    properties: mainFormInputProperties,
    value: formValues.fieldValues,
    onChange: values => handleFormValueChange(values, "fieldValues"),
    error: formErrors.fieldValues ?? {},
    errorClassName: styles.error
  });

  const configurationInputs = useInputRepresenter({
    properties: configurationInputProperties,
    value: formValues.configurationValues,
    onChange: values => handleFormValueChange(values, "configurationValues"),
    error: formErrors.configurationValues ?? {},
    errorClassName: styles.error
  });

  const defaultInput = useInputRepresenter({
    properties: defaultInputProperty ? ({default: defaultInputProperty} as TypeProperties) : {},
    value: defaultInputProperty ? {default: formValues.defaultValue} : {},
    onChange: values => handleFormValueChange(values.default, "defaultValue"),
    error: formErrors.defaultValue ?? {},
    errorClassName: styles.error
  });

  const presetInputs = useInputRepresenter({
    properties: presetInputProperties ?? {},
    value: formValues.presetValues ?? {},
    onChange: values => handleFormValueChange(values, "presetValues"),
    error: formErrors.presetValues ?? {},
    errorClassName: styles.error
  });

  const tabs = useMemo(() => {
    const items: TypeFluidContainer[] = [];
    let currentIndex = 0;
    const createConfig = (children: ReactNode, element: JSX.Element) => {
      const tabIndex = currentIndex;
      const item = {
        prefix: {
          children,
          onClick: () => setActiveTab(tabIndex)
        },
        element
      } as TypeFluidContainer;
      items.push(item);
      currentIndex++;
    };

    if (innerFieldExists) {
      createConfig(
        "Inner Fields",
        <div>
          {formValues.innerFields?.map?.((field: FieldFormState, i: number) => (
            <InnerField
              key={i}
              field={field}
              onSaveInnerField={handleSaveInnerField}
              onDeleteInnerField={handleDeleteInnerField}
            />
          ))}
        </div>
      );
    }

    if (type === "string") {
      createConfig("Presets", <div className={styles.presetsContainer}>{presetInputs}</div>);
    }

    if (defaultInputProperty) {
      createConfig("Default", defaultInput as unknown as JSX.Element);
    }

    createConfig(
      "Configuration",
      <div className={styles.configuration}>{configurationInputs}</div>
    );
    return items;
  }, [type, innerFieldExists, configurationInputs, formValues.innerFields, defaultInput]);

  const tabItems: {prefix?: TypeFlexElement}[] = useMemo(
    () => tabs.map(i => ({prefix: i.prefix})),
    [tabs]
  );

  useEffect(() => {
    setActiveTab(0);
  }, [type]);

  return (
    <FlexElement
      direction="vertical"
      gap={10}
      className={`${styles.contentContainer} ${className || ""}`}
    >
      <FluidContainer
        dimensionX="fill"
        dimensionY="hug"
        alignment="leftCenter"
        className={styles.item}
        root={{
          children: (
            <Text dimensionX="fill" className={styles.displayer}>
              {type}
            </Text>
          ),
          dimensionX: "fill"
        }}
        gap={10}
        prefix={{
          children: (
            <Icon
              name={FIELD_REGISTRY[type as keyof typeof FIELD_REGISTRY]?.display.icon as IconName}
            />
          )
        }}
        suffix={{children: iconName && <Icon name={iconName} />}}
      />
      {mainFormInputs}
      {tabItems.length > 0 && (
        <Tab
          type="underline"
          indicatorMode={tabItems.length > 2 ? "equal" : "fit"}
          dimensionX="fill"
          items={tabItems}
          value={activeTab}
          onChange={setActiveTab}
          className={`${styles.tab} ${tabItems.length > 2 ? styles.bigTab : styles.smallTab}`}
        />
      )}
      {tabs[activeTab] && (tabs[activeTab] as {element: JSX.Element}).element}
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
        {innerFieldExists && (
          <BucketFieldPopup
            onSaveAndClose={handleCreateInnerField}
            popupType="add-inner-field"
            placement="leftStart"
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
      {error && (
        <div className={innerFieldExists ? styles.innerFieldsError : styles.defaultError}>
          <div className={styles.errorTextContainer}>
            <Text className={styles.errorText} variant="danger">
              {error}
            </Text>
          </div>
        </div>
      )}
    </FlexElement>
  );
};

export default memo(BucketAddFieldView);
