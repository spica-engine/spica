import {
  Text,
  Button,
  FlexElement,
  FluidContainer,
  Icon,
  Modal,
  useInputRepresenter
} from "oziko-ui-kit";
import {useCallback, useEffect, useRef, useState} from "react";
import styles from "./NewBucketEntryPopup.module.scss";
import type {BucketType} from "src/services/bucketService";
import {useBucket} from "../../../contexts/BucketContext";
import useLocalStorage from "../../../hooks/useLocalStorage";
import type {TypeInputRepresenterError} from "oziko-ui-kit/build/dist/custom-hooks/useInputRepresenter";
import {
  cleanValueRecursive,
  findFirstErrorId,
  generateInitialValues
} from "./NewBucketEntryPopupUtils";
import {useValueProperties, useValidation} from "./NewBucketEntryPopupHooks";

type NewBucketEntryPopupProps = {
  bucket: BucketType;
};

const NewBucketEntryPopup = ({bucket}: NewBucketEntryPopupProps) => {
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
  const {validateValues} = useValidation();

  useEffect(() => {
    setApiError(createBucketEntryError);
  }, [createBucketEntryError]);

  useEffect(() => {
    setApiError(null);
    setErrors({});
    setValue(generateInitialValues(formattedProperties));
  }, [isOpen, formattedProperties]);

  useEffect(() => {
    if (!errors || Object.keys(errors).length === 0) return;
    const newErrors = validateValues(value, formattedProperties as any, bucket?.required || []);
    setErrors((newErrors as TypeInputRepresenterError) || {});
  }, [value, validateValues, formattedProperties, bucket?.required]);

  const inputRepresentation = useInputRepresenter({
    properties: formattedProperties,
    onChange: setValue,
    value,
    containerClassName: styles.inputFieldContainer,
    error: errors
  });

  const modalBody = useRef<HTMLDivElement>(null);
  const handleSubmit = useCallback(async () => {
    const validationErrors = validateValues(
      value,
      formattedProperties as any,
      bucket?.required || []
    );

    if (validationErrors && Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors as TypeInputRepresenterError);

      const firstErrorId = findFirstErrorId(validationErrors, formattedProperties);
      if (firstErrorId) {
        const errorElement = document.getElementById(firstErrorId);
        errorElement?.scrollIntoView({behavior: "smooth", block: "center"});
      } else {
        modalBody.current?.scrollTo({top: 0, behavior: "smooth"});
      }

      return;
    }

    const cleaned = Object.fromEntries(
      Object.entries(value).map(([key, val]) => [
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

  const handleOpenModal = () => setIsOpen(true);
  const handleCloseModal = () => setIsOpen(false);

  return (
    <>
      <Button onClick={handleOpenModal}>
        <FluidContainer prefix={{children: <Icon name="plus" />}} root={{children: "New Entry"}} />
      </Button>
      {isOpen && (
        <Modal
          showCloseButton={false}
          isOpen
          onClose={handleCloseModal}
          title="New Bucket Entry"
          className={styles.modalContent}
        >
          <Modal.Body className={styles.modalBody} ref={modalBody}>
            <FlexElement gap={10} direction="vertical" className={styles.formContainer}>
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
          </Modal.Body>
        </Modal>
      )}
    </>
  );
};

export default NewBucketEntryPopup;
