import {
  Text,
  Button,
  FlexElement,
  FluidContainer,
  Icon,
  Tab,
  type IconName,
  type TypeFlexElement,
  type TypeFluidContainer,
  Select,
  type TypeValue
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
import BucketFieldConfigurationPopup, {type PopupType} from "../../molecules/bucket-field-popup/BucketFieldConfigurationPopup";
import {useInputRepresenter} from "oziko-ui-kit";
import {FIELD_REGISTRY} from "../../../domain/fields/registry";
import type {TypeProperties} from "oziko-ui-kit/dist/custom-hooks/useInputRepresenter";
import type {FieldFormState} from "../../../domain/fields/types";
import {FieldKind, type InnerFieldFormState} from "../../../domain/fields/types";

type InnerFieldProps = {
  field: InnerFieldFormState;
  onSaveInnerField: (values: InnerFieldFormState) => void;
  onDeleteInnerField: (field: FieldFormState) => void;
  forbiddenFieldNames: string[];
  popupId?: string;
};

const iconsMap: Record<Exclude<PopupType, "add-field">, IconName> = {
  "edit-inner-field": "pencil",
  "add-inner-field": "plus"
};

const InnerField: FC<InnerFieldProps> = memo(
  ({field, onSaveInnerField, onDeleteInnerField, forbiddenFieldNames, popupId}) => {
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
                forbiddenFieldNames={forbiddenFieldNames.filter(
                  name => name !== field.fieldValues.title
                )}
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
  }
);

type BucketAddFieldViewProps = {
  className?: string;
  formValues: FieldFormState;
  formErrors: FormErrors;
  error: string | null;
  mainFormInputProperties: TypeProperties;
  configurationInputProperties: TypeProperties;
  defaultInputProperty?: TypeProperties[keyof TypeProperties];
  presetInputProperties?: TypeProperties;
  multipleSelectionTabProperties?: TypeProperties;
  isLoading: boolean;
  handleFormValueChange: (
    values: FieldFormState,
    formValuesAttribute: keyof FieldFormState
  ) => void;
  handleSaveAndClose: () => void;
  handleCreateInnerField: (values: FieldFormState) => void;
  handleSaveInnerField: (values: InnerFieldFormState) => void;
  handleDeleteInnerField: (values: FieldFormState) => void;
  popupId?: string;
  type: FieldKind;
  popupType?: PopupType;
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
  multipleSelectionTabProperties,
  isLoading,
  handleFormValueChange,
  handleSaveAndClose,
  handleCreateInnerField,
  handleSaveInnerField,
  handleDeleteInnerField,
  popupId,
  type,
  popupType = "add-field"
}) => {
  const iconName = iconsMap[popupType as keyof typeof iconsMap];
  const field = FIELD_REGISTRY[type as keyof typeof FIELD_REGISTRY];

  const innerFieldExists = useMemo(
    () => field?.requiresInnerFields?.(formValues) ?? false,
    [field, formValues.fieldValues]
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

  const multipleSelectionTabInputs = useInputRepresenter({
    properties: multipleSelectionTabProperties ?? {},
    value: formValues.multipleSelectionTab ?? {},
    onChange: values => handleFormValueChange(values, "multipleSelectionTab"),
    error: formErrors.multipleSelectionTab ?? {},
    errorClassName: styles.error
  });

  const forbiddenFieldNames = useMemo(
    () => formValues.innerFields?.map(f => f.fieldValues.title) || [],
    [formValues.innerFields]
  );

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
        <>
          {formValues?.innerFields?.length && (
            <div>
              {formValues.innerFields.map((field: InnerFieldFormState, i: number) => (
                <InnerField
                  key={i}
                  field={field}
                  onSaveInnerField={handleSaveInnerField}
                  onDeleteInnerField={handleDeleteInnerField}
                  forbiddenFieldNames={forbiddenFieldNames}
                  popupId={popupId}
                />
              ))}
            </div>
          )}
        </>
      );
    }

    if (presetInputProperties) {
      createConfig("Presets", <div className={styles.presetsContainer}>{presetInputs}</div>);
    }

    if (type === FieldKind.Multiselect) {
      createConfig(
        "Multiple Selection",
        <div className={styles.multipleSelectionTab}>{multipleSelectionTabInputs}</div>
      );
    }

    createConfig(
      "Configuration",
      <div className={styles.configurationOptionsContainer}>{configurationInputs}</div>
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

  const [isSelectInnerFieldOpen, setIsSelectInnerFieldOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<TypeValue | null>(null);

  const handleSelectInnerField = (value: TypeValue) => setSelectedType(value);
  const handleOpenInnerField = () => setIsSelectInnerFieldOpen(true);

  const handleCloseInnerField = () => {
    setSelectedType(null);
    setIsSelectInnerFieldOpen(false);
  };

  const handleSaveAndCloseInnerField = (values: FieldFormState) => {
    handleCreateInnerField(values);
    handleCloseInnerField();
  };

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
              {field?.display.label}
            </Text>
          ),
          dimensionX: "fill"
        }}
        gap={10}
        prefix={{
          children: <Icon name={field?.display.icon as IconName} />
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
      {defaultInput}
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
          <Button
            color="default"
            variant="dashed"
            className={styles.buttonInnerFields}
            onClick={handleOpenInnerField}
          >
            <FluidContainer
              prefix={{children: <Icon name="plus" size="sm" />}}
              root={{children: "Add New Inner Field"}}
            />
          </Button>
        )}
      </div>
      {isSelectInnerFieldOpen && (
        <BucketFieldConfigurationPopup
          isOpen={!!selectedType}
          selectedType={selectedType as FieldKind}
          onClose={handleCloseInnerField}
          onSaveAndClose={handleSaveAndCloseInnerField}
          popupType="add-inner-field"
          popoverClassName={styles.selectInnerFieldPopup}
          forbiddenFieldNames={forbiddenFieldNames}
        >
          <Select
            className={styles.selectInnerField}
            options={Object.keys(FIELD_REGISTRY)}
            value={selectedType ?? undefined}
            onChange={handleSelectInnerField}
          />
        </BucketFieldConfigurationPopup>
      )}
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
