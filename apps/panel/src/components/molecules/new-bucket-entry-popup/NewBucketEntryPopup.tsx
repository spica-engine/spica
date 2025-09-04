import {
  Text,
  Button,
  FlexElement,
  FluidContainer,
  Icon,
  Modal,
  useInputRepresenter
} from "oziko-ui-kit";
import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import styles from "./NewBucketEntryPopup.module.scss";
import type {BucketType, Properties, Property} from "src/services/bucketService";
import {useBucket} from "../../../contexts/BucketContext";
import useLocalStorage from "../../../hooks/useLocalStorage";
import type {TypeInputRepresenterError} from "oziko-ui-kit/build/dist/custom-hooks/useInputRepresenter";

type NewBucketEntryPopupProps = {
  bucket: BucketType;
};

const DEFAULT_VALUES = {
  color: "",
  multiselect: [],
  number: undefined,
  relation: []
} as const;

type RelationState = {
  skip: number;
  total: number;
  lastSearch: string;
};

// Utility functions
const isObjectEffectivelyEmpty = (obj: any): boolean => {
  if (obj == null || typeof obj !== "object") return true;

  return Object.keys(obj).every(
    key =>
      obj[key] === undefined ||
      obj[key] === null ||
      obj[key] === "" ||
      (Array.isArray(obj[key]) && obj[key].length === 0) ||
      (typeof obj[key] === "object" && isObjectEffectivelyEmpty(obj[key]))
  );
};

const cleanValue = (value: any, type: string) => {
  if (type === "location" && value) {
    return {type: "Point", coordinates: [value.lat, value.lng]};
  }

  if (type === "array") {
    return value?.length === 1 && value[0] === "" ? undefined : value;
  }

  if (type === "relation") {
    return value?.value;
  }

  if (type === "multiselect") {
    return value?.length === 0 ? undefined : value;
  }

  if (type === "object") {
    const cleanedObject = Object.fromEntries(
      Object.entries(value).map(([k, v]) => [
        k,
        v === "" || (Array.isArray(v) && v.length === 0) ? undefined : v
      ])
    );
    return isObjectEffectivelyEmpty(cleanedObject) ? undefined : cleanedObject;
  }

  return value === "" ? undefined : value;
};

const buildOptionsUrl = (bucketId: string, skip = 0, searchValue?: string) => {
  const base = `${import.meta.env.VITE_BASE_URL}/api/bucket/${bucketId}/data?paginate=true&relation=true&limit=25&sort=%7B%22_id%22%3A-1%7D`;
  const filter = searchValue
    ? `&filter=${encodeURIComponent(
        JSON.stringify({
          $or: [{title: {$regex: searchValue, $options: "i"}}]
        })
      )}`
    : "";

  return `${base}${filter}&skip=${skip}`;
};

// Custom hooks for better organization
const useRelationHandlers = (authToken: string) => {
  const [relationStates, setRelationStates] = useState<Record<string, RelationState>>({});
  const getOptionsMap = useRef<Record<string, () => Promise<any[]>>>({});
  const loadMoreOptionsMap = useRef<Record<string, () => Promise<any[]>>>({});
  const searchOptionsMap = useRef<Record<string, (s: string) => Promise<any[]>>>({});

  // Track active requests for cancellation
  const abortControllersRef = useRef<Record<string, AbortController>>({});

  // Cleanup function to clear all maps
  const clearAllMaps = useCallback(() => {
    // Cancel any pending requests
    Object.values(abortControllersRef.current).forEach(controller => {
      controller.abort();
    });

    // Clear all maps
    getOptionsMap.current = {};
    loadMoreOptionsMap.current = {};
    searchOptionsMap.current = {};
    abortControllersRef.current = {};

    // Reset relation states
    setRelationStates({});
  }, []);

  const createRelationHandlers = useCallback(
    (bucketId: string, fullKey: string) => {
      if (!getOptionsMap.current[fullKey]) {
        getOptionsMap.current[fullKey] = async () => {
          // Cancel any existing request for this key
          if (abortControllersRef.current[fullKey]) {
            abortControllersRef.current[fullKey].abort();
          }

          const abortController = new AbortController();
          abortControllersRef.current[fullKey] = abortController;

          try {
            const result = await fetch(buildOptionsUrl(bucketId, 0), {
              headers: {authorization: `IDENTITY ${authToken}`},
              signal: abortController.signal
            });

            if (result.ok) {
              const data = await result.json();

              const newState = {
                skip: 25,
                total: data?.meta?.total || 0,
                lastSearch: ""
              };

              setRelationStates(prev => ({...prev, [fullKey]: {...prev[fullKey], ...newState}}));

              return data?.data?.map((i: any) => ({label: i.title, value: i._id})) || [];
            }
            return [];
          } catch (error) {
            if ((error as {name: string})?.name === "AbortError") {
              return []; // Request was cancelled, return empty array
            }
            throw error;
          } finally {
            // Clean up the abort controller reference
            delete abortControllersRef.current[fullKey];
          }
        };
      }

      if (!loadMoreOptionsMap.current[fullKey]) {
        loadMoreOptionsMap.current[fullKey] = async () => {
          const currentSkip = relationStates[fullKey]?.skip || 0;
          const lastSearch = relationStates[fullKey]?.lastSearch || "";

          if (abortControllersRef.current[`${fullKey}_loadMore`]) {
            abortControllersRef.current[`${fullKey}_loadMore`].abort();
          }

          const abortController = new AbortController();
          abortControllersRef.current[`${fullKey}_loadMore`] = abortController;

          try {
            const result = await fetch(buildOptionsUrl(bucketId, currentSkip, lastSearch), {
              headers: {authorization: `IDENTITY ${authToken}`},
              signal: abortController.signal
            });

            if (result.ok) {
              const data = await result.json();

              setRelationStates(prev => ({
                ...prev,
                [fullKey]: {...prev[fullKey], skip: currentSkip + 25}
              }));

              return data?.data?.map((i: any) => ({label: i.title, value: i._id})) || [];
            }
            return [];
          } catch (error) {
            if ((error as {name: string})?.name === "AbortError") {
              return [];
            }
            throw error;
          } finally {
            delete abortControllersRef.current[`${fullKey}_loadMore`];
          }
        };
      }

      if (!searchOptionsMap.current[fullKey]) {
        searchOptionsMap.current[fullKey] = async (searchString: string) => {
          setRelationStates(prev => ({
            ...prev,
            [fullKey]: {...prev[fullKey], lastSearch: searchString}
          }));

          if (abortControllersRef.current[`${fullKey}_search`]) {
            abortControllersRef.current[`${fullKey}_search`].abort();
          }

          const abortController = new AbortController();
          abortControllersRef.current[`${fullKey}_search`] = abortController;

          try {
            const result = await fetch(buildOptionsUrl(bucketId, 0, searchString), {
              headers: {authorization: `IDENTITY ${authToken}`},
              signal: abortController.signal
            });

            if (result.ok) {
              const data = await result.json();

              const newState = {
                skip: 25,
                total: data?.meta?.total || 0
              };

              setRelationStates(prev => ({
                ...prev,
                [fullKey]: {...prev[fullKey], ...newState}
              }));

              return data?.data?.map((i: any) => ({label: i.title, value: i._id})) || [];
            }
            return [];
          } catch (error) {
            if ((error as {name: string})?.name === "AbortError") {
              return [];
            }
            throw error;
          } finally {
            delete abortControllersRef.current[`${fullKey}_search`];
          }
        };
      }
    },
    [authToken, relationStates]
  );

  return {
    relationStates,
    getOptionsMap,
    loadMoreOptionsMap,
    searchOptionsMap,
    createRelationHandlers,
    clearAllMaps
  };
};

const usePropertiesProcessor = (bucket: BucketType, authToken: string) => {
  const {
    relationStates,
    getOptionsMap,
    loadMoreOptionsMap,
    searchOptionsMap,
    createRelationHandlers,
    clearAllMaps
  } = useRelationHandlers(authToken);

  // Cleanup when bucket properties change
  useEffect(() => {
    return () => {
      clearAllMaps();
    };
  }, [bucket._id, clearAllMaps]); // Clear when bucket changes

  const processProperties = useCallback(
    (properties: any, prefix = "") => {
      Object.entries(properties).forEach(([key, property]: [string, any]) => {
        const fullKey = prefix ? `${prefix}.${key}` : key;

        if (property.type === "relation") {
          createRelationHandlers(property.bucketId, fullKey);
        } else if (property.type === "object" && property.properties) {
          processProperties(property.properties, fullKey);
        }
      });
    },
    [createRelationHandlers]
  );

  const formattedBaseProperties = useMemo(() => {
    const newProperties = {...bucket.properties};

    Object.entries(newProperties).forEach(([key, property]: [string, any]) => {
      if (property.type === "object" && !property.properties) {
        property.properties = {};
      }
    });

    processProperties(newProperties);
    return newProperties;
  }, [bucket.properties, processProperties]);

  const attachRelationFunctions = useCallback(
    (properties: any, prefix = ""): any => {
      const newProperties: Record<string, any> = {};

      Object.entries(properties).forEach(([key, property]: [string, any]) => {
        const fullKey = prefix ? `${prefix}.${key}` : key;

        if (property.type === "relation") {
          newProperties[key] = {
            ...property,
            getOptions: getOptionsMap.current[fullKey],
            loadMoreOptions: loadMoreOptionsMap.current[fullKey],
            searchOptions: searchOptionsMap.current[fullKey],
            totalOptionsLength: relationStates?.[fullKey]?.total || 0
          };
        } else if (property.type === "object" && property.properties) {
          newProperties[key] = {
            ...property,
            properties: attachRelationFunctions(property.properties, fullKey)
          };
        } else {
          newProperties[key] = property;
        }
      });

      return newProperties;
    },
    [relationStates, getOptionsMap, loadMoreOptionsMap, searchOptionsMap]
  );

  const formattedProperties = useMemo(() => {
    return attachRelationFunctions(formattedBaseProperties);
  }, [formattedBaseProperties, attachRelationFunctions]);

  return formattedProperties;
};

const useFormValidation = () => {
  const cleanValueRecursive = useCallback((val: any, property: Property): any => {
    if (property?.type === "object" && property.properties) {
      const cleanedObject = Object.fromEntries(
        Object.entries(val || {}).map(([k, v]) => [
          k,
          property.properties[k] ? cleanValueRecursive(v, property.properties[k]) : v
        ])
      );
      return isObjectEffectivelyEmpty(cleanedObject) ? undefined : cleanedObject;
    }
    return cleanValue(val, property?.type);
  }, []);

  const validateForm = useCallback(
    (
      value: Record<string, any>,
      formattedProperties: {[key: string]: Property},
      requiredFields: string[]
    ) => {
      console.log("Validating form...", value, formattedProperties, requiredFields);
      type FormError = {
        [key: string]: string | FormError;
      };

      const errors: FormError = {};

      for (const [key, property] of Object.entries(formattedProperties)) {
        const val = value[key];

        if (requiredFields.includes(key) && (val === undefined || val === null || val === "")) {
          errors[key] = "This field is required";
          continue;
        }

        if ((property.type === "object" || property.type === "array") && property.properties) {
          const nestedErrors = validateForm(val, property.properties, property.required || []);
          if (nestedErrors && Object.keys(nestedErrors).length > 0) {
            errors[key] = nestedErrors as FormError;
          }
        }

        if (
          property.type === "number" &&
          property.maximum &&
          val !== undefined &&
          val > property.maximum
        ) {
          errors[key] = `Value must be less than ${property.maximum}`;
        } else if (
          property.type === "number" &&
          property.minimum &&
          val !== undefined &&
          val < property.minimum
        ) {
          errors[key] = `Value must be greater than ${property.minimum}`;
        }

        if (
          property.type === "array" &&
          Array.isArray(val) &&
          property.maxItems &&
          val.length > property.maxItems
        ) {
          errors[key] = `Array must contain at most ${property.maxItems} items`;
        } else if (
          property.type === "array" &&
          Array.isArray(val) &&
          property.minItems &&
          val.length < property.minItems
        ) {
          errors[key] = `Array must contain at least ${property.minItems} items`;
        }

        if (property.type === "string" && property.pattern) {
          const regex = new RegExp(property.pattern);
          if (!regex.test(val)) {
            errors[key] = `This field does not match the required pattern "${property.pattern}"`;
          }
        }
      }
      return Object.keys(errors).length > 0 ? errors : undefined;
    },
    []
  );

  return {cleanValueRecursive, validateForm};
};

const useInitialValues = (formattedProperties: Properties) => {
  const generateInitialValues = useCallback(
    (properties?: Properties) => {
      const propertiesToUse = properties ?? formattedProperties;
      return Object.keys(propertiesToUse).reduce((acc: Record<string, any>, key) => {
        const property = propertiesToUse[key];

        if (property.type === "array") {
          acc[key] = [
            property.items.properties
              ? generateInitialValues(property.items.properties)
              : DEFAULT_VALUES[property.items.type as keyof typeof DEFAULT_VALUES] || ""
          ];
        } else if (property.type === "object" && property.properties) {
          acc[key] = generateInitialValues(property.properties);
        } else {
          acc[key] =
            property.type in DEFAULT_VALUES
              ? DEFAULT_VALUES[property.type as keyof typeof DEFAULT_VALUES]
              : "";
        }
        return acc;
      }, {});
    },
    [formattedProperties]
  );

  return generateInitialValues;
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

  // Handle API errors
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

  const handleSubmit = useCallback(async () => {
    const validationErrors = validateForm(value, formattedProperties, bucket?.required || []);

    if (validationErrors && Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors as TypeInputRepresenterError);
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
          <Modal.Body className={styles.modalBody}>
            <div className={styles.modalBodyContent}>
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
              </FlexElement>
            </div>

            {apiError && (
              <div className={styles.errorTextContainer}>
                <Text className={styles.errorText} variant="danger">
                  {apiError}
                </Text>
              </div>
            )}
          </Modal.Body>
        </Modal>
      )}
    </>
  );
};

export default NewBucketEntryPopup;
