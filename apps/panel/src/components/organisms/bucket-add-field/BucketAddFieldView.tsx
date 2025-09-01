import {
  Text,
  Button,
  FlexElement,
  FluidContainer,
  Icon,
  Tab,
  useInputRepresenter,
  type IconName,
  type TypeFlexElement,
  type TypeFluidContainer,
  type TypeInputType
} from "oziko-ui-kit";
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type FC,
  type JSX,
  type ReactNode
} from "react";
import type {BucketType, Property} from "src/services/bucketService";
import type {
  FormValues,
  FullSaveFieldHandlerArg,
  FieldType,
  TypeSaveFieldHandler
} from "./BucketAddFieldBusiness";
import {presetProperties} from "./BucketAddFieldSchema";
import styles from "./BucketAddField.module.scss";
import BucketFieldPopup from "../../../components/atoms/bucket-field-popup/BucketFieldPopup";
import BucketAddFieldBusiness from "./BucketAddFieldBusiness";
import {DEFAULT_FORM_VALUES} from "./BucketAddField";

type InnerFieldProps = {
  field: FieldType;
  bucket?: BucketType;
  buckets: BucketType[];
  onSaveInnerField: (arg: FullSaveFieldHandlerArg) => void;
  onDeleteInnerField: (field: FieldType) => void;
};

const InnerField: FC<InnerFieldProps> = memo(
  ({field, bucket, buckets, onSaveInnerField, onDeleteInnerField}) => {
    const [isEditing, setIsEditing] = useState(false);

    const handleSave = useCallback(
      (args: FullSaveFieldHandlerArg) => {
        onSaveInnerField(args);
        setIsEditing(false);
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
              <Text className={styles.innerFieldName}>{field.formValues?.fieldValues.title}</Text>
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
                <BucketAddFieldBusiness
                  name={field.formValues?.fieldValues.title ?? "innerField"}
                  type={field.type}
                  onSaveAndClose={handleSave as TypeSaveFieldHandler}
                  bucket={bucket as BucketType}
                  buckets={buckets}
                  initialValues={DEFAULT_FORM_VALUES}
                  onSuccess={() => setIsEditing(false)}
                  className={styles.innerField}
                />
              )}
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
  // Display props
  className?: string;
  title?: {text: string; icon: string};
  innerFieldStyles?: CSSProperties;

  // Form data
  type: TypeInputType;
  fieldValues: Record<string, any>;
  configurationValues: Record<string, any>;
  defaultValue: Record<string, any>;
  presetValues: Record<string, any>;
  fieldErrors: Record<string, string> | null;
  apiError: string | null;

  // Schema and configuration
  inputProperties: Record<string, any>;
  configFields: Record<string, any>;
  defaultProperty: Record<string, any>;

  // State
  activeTab: number;
  isLoading: boolean;
  innerFieldExists: boolean;

  // Event handlers
  setFormValues: React.Dispatch<React.SetStateAction<FormValues>>;
  setActiveTab: React.Dispatch<React.SetStateAction<number>>;
  handleSaveAndClose: () => void;
  handleCreateInnerField: (arg: {
    type: TypeInputType;
    fieldValues: Record<string, any>;
    configurationValues: Record<string, any>;
  }) => void;
  handleSaveInnerField: (arg: FullSaveFieldHandlerArg) => void;
  handleDeleteInnerField: (field: FieldType) => void;

  // External dependencies
  bucket: BucketType;
  buckets: BucketType[];
};

const BucketAddFieldView: FC<BucketAddFieldViewProps> = ({
  className,
  title,
  innerFieldStyles,
  type,
  fieldValues,
  configurationValues,
  defaultValue,
  presetValues,
  fieldErrors,
  apiError,
  inputProperties,
  configFields,
  defaultProperty,
  isLoading,
  innerFieldExists,
  setFormValues,
  handleSaveAndClose,
  handleCreateInnerField,
  handleSaveInnerField,
  handleDeleteInnerField,
  bucket,
  buckets
}) => {
  const [activeTab, setActiveTab] = useState(0);

  // Input representers
  const handleFormValueChange = (values: FormValues, formValuesAttribute: keyof FormValues) =>
    setFormValues(prev => {
      return {...prev, [formValuesAttribute]: values};
    });

  const inputRepresenter = useInputRepresenter({
    properties: inputProperties,
    value: fieldValues,
    onChange: values => handleFormValueChange(values, "fieldValues"),
    error: fieldErrors ?? {},
    errorClassName: styles.error
  });

  const configuration = useInputRepresenter({
    properties: configFields as unknown as Property,
    value: configurationValues,
    onChange: values => handleFormValueChange(values, "configurationValues")
  });

  const defaultInput = useInputRepresenter({
    properties: defaultProperty as unknown as Property,
    value: defaultValue,
    onChange: values => handleFormValueChange(values, "defaultValue")
  });

  const presetsRepresenter = useInputRepresenter({
    properties: presetProperties as unknown as Property, // presetProperties should be passed from parent
    value: presetValues,
    onChange: values => handleFormValueChange(values, "presetValues")
  });

  useEffect(() => {
    setActiveTab(0);
  }, [innerFieldExists, type]);

  // Build tabs based on field type and configuration
  let currentIndex = 0;
  const tabs: TypeFluidContainer[] = [];
  const createConfig = (children: ReactNode, element: JSX.Element) => {
    const item: TypeFluidContainer = {
      prefix: {children, onClick: () => setActiveTab(currentIndex++)},
      element
    } as TypeFluidContainer;
    tabs.push(item);
  };

  if (innerFieldExists) {
    createConfig(
      "Inner Fields",
      <div>
        {fieldValues.innerFields?.map?.((field: FieldType, i: number) => (
          <InnerField
            key={i}
            field={field}
            buckets={buckets}
            bucket={bucket}
            onSaveInnerField={handleSaveInnerField}
            onDeleteInnerField={handleDeleteInnerField}
          />
        ))}
      </div>
    );
  }

  if (type === "string") {
    createConfig("Presets", <div className={styles.presetsContainer}>{presetsRepresenter}</div>);
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
    createConfig("Default", defaultInput as unknown as JSX.Element);
  }

  createConfig("Configuration", <div className={styles.configuration}>{configuration}</div>);

  const tabItems: {prefix?: TypeFlexElement}[] = useMemo(
    () => tabs.map(i => ({prefix: i.prefix})),
    [tabs]
  );

  return (
    <FlexElement
      direction="vertical"
      gap={10}
      className={`${styles.contentContainer} ${className || ""}`}
    >
      {/* Field Type Header */}
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

      {/* Main Form Fields */}
      {inputRepresenter}

      {/* Tabs Navigation */}
      {tabItems.length > 0 && (
        <Tab
          type="underline"
          indicatorMode={tabItems.length > 2 ? "equal" : "fit"}
          dimensionX="fill"
          items={tabItems}
          className={`${styles.tab} ${tabItems.length > 2 ? styles.bigTab : styles.smallTab}`}
        />
      )}

      {/* Tab Content */}
      {tabs[activeTab] && (tabs[activeTab] as {element: JSX.Element}).element}

      {/* Action Buttons */}
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
            buckets={buckets as BucketType[]}
            bucket={bucket}
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

      {/* Error Display */}
      {apiError && (
        <div className={innerFieldExists ? styles.innerFieldsError : styles.defaultError}>
          <div className={styles.errorTextContainer}>
            <Text className={styles.errorText} variant="danger">
              {apiError}
            </Text>
          </div>
        </div>
      )}
    </FlexElement>
  );
};

export default memo(BucketAddFieldView);
