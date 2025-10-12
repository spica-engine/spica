import {
  Text,
  Button,
  FlexElement,
  FluidContainer,
  Icon,
  useInputRepresenter,
  Drawer
} from "oziko-ui-kit";
import {useCallback, useEffect, useRef, useState} from "react";
import styles from "./NewBucketEntryDrawer.module.scss";
import type {BucketType} from "src/services/bucketService";
import {useBucket} from "../../../contexts/BucketContext";
import useLocalStorage from "../../../hooks/useLocalStorage";
import type {TypeInputRepresenterError} from "oziko-ui-kit/dist/custom-hooks/useInputRepresenter";
import {
  cleanValueRecursive,
  findFirstErrorId,
  generateInitialValues,
  validateValues
} from "./NewBucketEntryDrawerUtils";
import {useValueProperties} from "./NewBucketEntryDrawerHooks";
import {FIELD_REGISTRY} from "../../../domain/fields";

type NewBucketEntryDrawerProps = {
  bucket: BucketType;
};

const NewBucketEntryDrawer = ({bucket}: NewBucketEntryDrawerProps) => {
  const [authToken] = useLocalStorage("token", "");
  const {createBucketEntry, createBucketEntryError} = useBucket();

  const [isOpen, setIsOpen] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<TypeInputRepresenterError>({});

  const formattedProperties = useValueProperties(bucket, authToken);

  const [value, setValue] = useState<Record<string, any>>(() =>
    generateInitialValues(formattedProperties)
  );

  useEffect(() => {
    setApiError(createBucketEntryError);
  }, [createBucketEntryError]);

  useEffect(() => {
    setApiError(null);
    setErrors({});
    setValue(generateInitialValues(formattedProperties));
  }, [isOpen]);

  useEffect(() => {
    if (!errors || Object.keys(errors).length === 0) return;
    const newErrors = validateValues(value, formattedProperties, bucket?.required || []);
    setErrors((newErrors as TypeInputRepresenterError) || {});
  }, [value, validateValues, formattedProperties, bucket?.required]);

  const normalizedValue =
    Object.keys(value).length === 0 && value.constructor === Object ? "" : value;
  const inputRepresentation = useInputRepresenter({
    properties: formattedProperties,
    onChange: setValue,
    value: normalizedValue,
    containerClassName: styles.inputFieldContainer,
    error: errors
  });

  const formContainerRef = useRef<HTMLDivElement>(null);
  const handleSubmit = useCallback(async () => {
    const validationErrors = validateValues(value, formattedProperties, bucket?.required || []);

    if (validationErrors && Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors as TypeInputRepresenterError);

      const firstErrorId = findFirstErrorId(validationErrors, formattedProperties);
      if (firstErrorId) {
        const errorElement = document.getElementById(firstErrorId);
        errorElement?.scrollIntoView({behavior: "smooth", block: "center"});
      } else {
        formContainerRef.current?.scrollTo({top: 0, behavior: "smooth"});
      }

      return;
    }

    let normalized: Record<string, any> = {};
    for (const [key, property] of Object.entries(formattedProperties || {})) {
      const kind = property.type as keyof typeof FIELD_REGISTRY;
      const field = FIELD_REGISTRY[kind];
      const val = field?.getSaveReadyValue(value[key], property);
      normalized[key] = val;
    }

    const cleaned = Object.fromEntries(
      Object.entries(normalized).map(([key, val]) => [
        key,
        cleanValueRecursive(val, formattedProperties[key], bucket.required?.includes(key), true)
      ])
    );
    try {
      setIsLoading(true);
      const result = await createBucketEntry(bucket._id, cleaned);

      if (result) {
        setIsOpen(false);
        setValue(generateInitialValues(formattedProperties));
      }
    } catch (error) {
      console.error("Error creating bucket entry:", error);
    } finally {
      setIsLoading(false);
    }
  }, [
    value,
    validateValues,
    formattedProperties,
    bucket?.required,
    bucket._id,
    createBucketEntry,
    generateInitialValues
  ]);

  const handleOpenDrawer = () => setIsOpen(true);
  const handleCloseDrawer = () => setIsOpen(false);

  return (
    <>
      <Button onClick={handleOpenDrawer}>
        <FluidContainer prefix={{children: <Icon name="plus" />}} root={{children: "New Entry"}} />
      </Button>
      <Drawer
        placement="right"
        showCloseButton={false}
        isOpen={isOpen}
        onClose={handleCloseDrawer}
        size={600}
        contentClassName={styles.drawerContent}
        scrollableContentClassName={styles.drawerContentScrollableContent}
      >
        <div className={styles.formContainer} ref={formContainerRef}>
          <FlexElement direction="vertical" gap={10} className={styles.formContent}>
            {inputRepresentation}
            <FlexElement className={styles.footer}>
              {apiError && (
                <Text className={styles.errorText} variant="danger">
                  {apiError}
                </Text>
              )}
              <Button
                onClick={handleSubmit}
                loading={isLoading}
                disabled={isLoading}
                className={styles.saveButton}
              >
                <FluidContainer
                  prefix={{children: <Icon name="save" />}}
                  root={{children: "Save and close"}}
                />
              </Button>
            </FlexElement>
          </FlexElement>
        </div>
      </Drawer>
    </>
  );
};

export default NewBucketEntryDrawer;
