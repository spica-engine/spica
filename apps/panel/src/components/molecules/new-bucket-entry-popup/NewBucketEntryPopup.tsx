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
import { findFirstErrorId } from "./NewBucketEntryPopupUtils";
import { usePropertiesProcessor, useInitialValues, useFormValidation } from "./NewBucketEntryPopupHooks";

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

  const formattedProperties = usePropertiesProcessor(bucket, authToken);
  const generateInitialValues = useInitialValues(formattedProperties);
  const [value, setValue] = useState<Record<string, any>>(() => generateInitialValues());
  const {cleanValueRecursive, validateForm} = useFormValidation();

  useEffect(() => {
    setApiError(createBucketEntryError);
  }, [createBucketEntryError]);

  useEffect(() => {
    setApiError(null);
    setErrors({});
    setValue(generateInitialValues());
  }, [isOpen]);

  useEffect(() => {
    if (!errors || Object.keys(errors).length === 0) return;
    const newErrors = validateForm(value, formattedProperties, bucket?.required || []);
    setErrors((newErrors as TypeInputRepresenterError) || {});
  }, [value, validateForm, formattedProperties, bucket?.required]);

  const inputRepresentation = useInputRepresenter({
    properties: formattedProperties,
    onChange: setValue,
    value,
    containerClassName: styles.inputFieldContainer,
    error: errors
  });

  const modalBody = useRef<HTMLDivElement>(null);
  const handleSubmit = useCallback(async () => {
    const validationErrors = validateForm(value, formattedProperties, bucket?.required || []);

    if (validationErrors && Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors as TypeInputRepresenterError);

      const firstErrorId = findFirstErrorId(validationErrors, formattedProperties);
      if (firstErrorId) {
        const errorElement = document.getElementById(firstErrorId);
        if (errorElement) {
          errorElement.scrollIntoView({behavior: "smooth", block: "center"});
        }
      } else {
        modalBody.current?.scrollTo({top: 0, behavior: "smooth"});
      }
      return;
    }

    const cleaned = Object.fromEntries(
      Object.entries(value).map(([key, val]) => [
        key,
        cleanValueRecursive(val, formattedProperties[key])
      ])
    );

    try {
      setIsLoading(true);
      const result = await createBucketEntry(bucket._id, cleaned);

      if (result) {
        setIsOpen(false);
        setValue(generateInitialValues());
      }
    } catch (error) {
      console.error("Error creating bucket entry:", error);
    } finally {
      setIsLoading(false);
    }
  }, [
    value,
    validateForm,
    formattedProperties,
    bucket?.required,
    bucket._id,
    cleanValueRecursive,
    createBucketEntry,
    generateInitialValues
  ]);

  const handleOpenModal = useCallback(() => setIsOpen(true), []);
  const handleCloseModal = useCallback(() => setIsOpen(false), []);

  return (
    <>
      <Button onClick={handleOpenModal}>
        <Icon name="plus" />
        New Entry
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
              <div className={styles.buttonContainer}>
                <Button
                  onClick={handleSubmit}
                  loading={isLoading}
                  disabled={isLoading}
                  className={styles.saveButton}
                >
                  <FluidContainer
                    prefix={{
                      children: <Icon name="save" />
                    }}
                    root={{
                      children: "Save and close"
                    }}
                  />
                </Button>
              </div>
              {apiError && (
                <div className={styles.errorTextContainer}>
                  <Text className={styles.errorText} variant="danger">
                    {apiError}
                  </Text>
                </div>
              )}
            </FlexElement>
          </Modal.Body>
        </Modal>
      )}
    </>
  );
};

export default NewBucketEntryPopup;
