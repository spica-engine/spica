import {Button, FlexElement, FluidContainer, Icon, Modal, useInputRepresenter} from "oziko-ui-kit";
import {useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState} from "react";
import styles from "./NewBucketEntryPopup.module.scss";
import type {BucketType, Properties} from "src/services/bucketService";
import {useBucket} from "../../../contexts/BucketContext";
import useLocalStorage from "../../../hooks/useLocalStorage";
import type {TypeProperties} from "oziko-ui-kit/dist/custom-hooks/useInputRepresenter";

type NewBucketEntryPopupProps = {
  bucket: BucketType;
};

const DEFAULT_VALUES = {
  color: "",
  multiselect: [],
  number: undefined,
  relation: undefined
};

function isObjectEffectivelyEmpty(obj: any): boolean {
  if (obj == null || typeof obj !== "object") return true;

  return Object.keys(obj).every(key => obj[key] === undefined);
}

function cleanValue(value: any, type: string) {
  if (type === "location" && value) {
    return {type: "Point", coordinates: [value.lat, value.lng]};
  }

  if (type === "array") {
    return value.length === 1 && value[0] === "" ? undefined : value;
  }

  if (type === "relation" || type === "multiselect") {
    return value.value;
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
}

function buildOptionsUrl(bucketId: string, skip = 0, searchValue?: string) {
  const base = `${import.meta.env.VITE_BASE_URL}/api/bucket/${bucketId}/data?paginate=true&relation=true&limit=25&sort=%7B%22_id%22%3A-1%7D`;
  const filter = searchValue
    ? `&filter=${encodeURIComponent(
        JSON.stringify({
          $or: [{title: {$regex: searchValue, $options: "i"}}]
        })
      )}`
    : "";

  return `${base}${filter}&skip=${skip}`;
}

type RelationState = {
  skip: number;
  total: number;
  lastSearch: string;
};

const NewBucketEntryPopup = ({bucket}: NewBucketEntryPopupProps) => {
  const [authToken] = useLocalStorage("token", "");
  const [relationStates, setRelationStates] = useState<Record<string, RelationState>>({});

  const getOptionsMap = useRef<Record<string, () => Promise<any[]>>>({});
  const loadMoreOptionsMap = useRef<Record<string, () => Promise<any[]>>>({});
  const searchOptionsMap = useRef<Record<string, (s: string) => Promise<any[]>>>({});

  const processProperties = useCallback(
    (properties: any, prefix = "") => {
      Object.entries(properties).forEach(([key, property]: [string, any]) => {
        const fullKey = prefix ? `${prefix}.${key}` : key;

        if (property.type === "relation") {
          if (!getOptionsMap.current[fullKey]) {
            getOptionsMap.current[fullKey] = async () => {
              const result = await fetch(buildOptionsUrl(property.bucketId, 0), {
                headers: {authorization: `IDENTITY ${authToken}`}
              });
              const data = await result.json();
              setRelationStates(prev => ({
                ...prev,
                [fullKey]: {
                  ...prev[fullKey],
                  skip: 25,
                  total: data.meta.total,
                  lastSearch: ""
                }
              }));
              return data.data.map((i: any) => ({label: i.title, value: i._id}));
            };
          }

          if (!loadMoreOptionsMap.current[fullKey]) {
            loadMoreOptionsMap.current[fullKey] = async () => {
              const currentSkip = relationStates[fullKey].skip || 0;
              const lastSearch = relationStates[fullKey].lastSearch;
              const result = await fetch(
                buildOptionsUrl(property.bucketId, currentSkip, lastSearch),
                {
                  headers: {authorization: `IDENTITY ${authToken}`}
                }
              );
              const data = await result.json();
              setRelationStates(prev => ({
                ...prev,
                [fullKey]: {...prev[fullKey], skip: currentSkip + 25}
              }));
              return data.data.map((i: any) => ({label: i.title, value: i._id}));
            };
          }

          if (!searchOptionsMap.current[fullKey]) {
            searchOptionsMap.current[fullKey] = async (searchString: string) => {
              setRelationStates(prev => ({
                ...prev,
                [fullKey]: {...prev[fullKey], lastSearch: searchString}
              }));
              const result = await fetch(buildOptionsUrl(property.bucketId, 0, searchString), {
                headers: {authorization: `IDENTITY ${authToken}`}
              });
              const data = await result.json();
              setRelationStates(prev => ({
                ...prev,
                [fullKey]: {...prev[fullKey], skip: 25, total: data.meta.total}
              }));
              return data.data.map((i: any) => ({label: i.title, value: i._id}));
            };
          }
        } else if (property.type === "object" && property.properties) {
          // Recursively process nested object properties
          processProperties(property.properties, fullKey);
        }
      });
    },
    [authToken, relationStates]
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
  }, [bucket.properties]);

  // Recursive function to attach relation functions to properties
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
            totalOptionsLength: relationStates[fullKey].total || 0
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
    [relationStates]
  );

  // Combine base properties with stable relation function references
  const formattedProperties = useMemo(() => {
    return attachRelationFunctions(formattedBaseProperties);
  }, [formattedBaseProperties, attachRelationFunctions]);

  const {createBucketEntry} = useBucket();
  const [isOpen, setIsOpen] = useState(false);

  const generateInitialValues = useCallback(
    (properties?: Properties) => {
      const propertiesToUse = properties ?? formattedProperties;
      return Object.keys(propertiesToUse).reduce((acc: Record<string, any>, key) => {
        const property = propertiesToUse[key];

        if (property.type === "array") {
          acc[key] = undefined;
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

  const [value, setValue] = useState<Record<string, any>>(generateInitialValues);
  const [isLoading, setIsLoading] = useState(false);
  const inputRepresentation = useInputRepresenter({
    properties: formattedProperties as TypeProperties,
    onChange: setValue,
    value
  });

  // Recursive function to clean nested values
  const cleanValueRecursive = useCallback((val: any, property: any): any => {
    if (property.type === "object" && property.properties) {
      const cleanedObject = Object.fromEntries(
        Object.entries(val || {}).map(([k, v]) => [
          k,
          property.properties[k] ? cleanValueRecursive(v, property.properties[k]) : v
        ])
      );
      return isObjectEffectivelyEmpty(cleanedObject) ? undefined : cleanedObject;
    }
    return cleanValue(val, property.type);
  }, []);

  const handleSubmit = async () => {
    const cleaned = Object.fromEntries(
      Object.entries(value).map(([key, val]) => [
        key,
        cleanValueRecursive(val, formattedProperties[key])
      ])
    );

    try {
      setIsLoading(true);
      const result = await createBucketEntry(bucket._id, cleaned);
      setIsLoading(false);
      if (!result) return;
      setIsOpen(false);
      setValue(generateInitialValues());
    } catch (error) {
      console.error("Error creating bucket entry:", error);
    }
  };

  return (
    <>
      <Button onClick={() => setIsOpen(true)}>
        <Icon name="plus" />
        New Entry
      </Button>
      {isOpen && (
        <Modal
          showCloseButton={false}
          isOpen
          onClose={() => setIsOpen(false)}
          title="New Bucket Entry"
          className={styles.modalContent}
        >
          <Modal.Body className={styles.modalBody}>
            <FlexElement gap={10} direction="vertical" className={styles.formContainer}>
              {inputRepresentation}
              <div className={styles.buttonContainer}>
                <Button onClick={handleSubmit} loading={isLoading} disabled={isLoading}>
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
          </Modal.Body>
        </Modal>
      )}
    </>
  );
};

export default NewBucketEntryPopup;
