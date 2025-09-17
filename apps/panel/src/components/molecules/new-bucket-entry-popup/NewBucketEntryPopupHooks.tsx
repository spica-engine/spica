import {useCallback, useMemo, useRef, useState} from "react";
import type {BucketType, Property} from "src/services/bucketService";
import {FIELD_REGISTRY} from "../../../domain/fields/registry";
import {buildOptionsUrl, cleanValue} from "./NewBucketEntryPopupUtils";

type RelationState = {
  skip: number;
  total: number;
  lastSearch: string;
};

const useRelationHandlers = (authToken: string) => {
  const [relationStates, setRelationStates] = useState<Record<string, RelationState>>({});
  const getOptionsMap = useRef<Record<string, () => Promise<any[]>>>({});
  const loadMoreOptionsMap = useRef<Record<string, () => Promise<any[]>>>({});
  const searchOptionsMap = useRef<Record<string, (s: string) => Promise<any[]>>>({});
  const abortControllersRef = useRef<Record<string, AbortController>>({});

  const ensureHandlers = useCallback(
    (bucketId: string, key: string) => {
      if (!getOptionsMap.current[key]) {
        getOptionsMap.current[key] = async () => {
          if (abortControllersRef.current[key]) abortControllersRef.current[key].abort();
          const ac = new AbortController();
          abortControllersRef.current[key] = ac;
          try {
            const res = await fetch(buildOptionsUrl(bucketId, 0), {
              headers: {authorization: `IDENTITY ${authToken}`},
              signal: ac.signal
            });
            if (!res.ok) return [];
            const data = await res.json();
            setRelationStates(prev => ({
              ...prev,
              [key]: {skip: 25, total: data?.meta?.total || 0, lastSearch: ""}
            }));
            return data?.data?.map((i: any) => ({label: i.title, value: i._id})) || [];
          } catch (e: any) {
            if (e?.name === "AbortError") return [];
            throw e;
          } finally {
            delete abortControllersRef.current[key];
          }
        };
      }

      if (!loadMoreOptionsMap.current[key]) {
        loadMoreOptionsMap.current[key] = async () => {
          const currentSkip = relationStates[key]?.skip || 0;
          const lastSearch = relationStates[key]?.lastSearch || "";
          const loadKey = `${key}_loadMore`;
          if (abortControllersRef.current[loadKey]) abortControllersRef.current[loadKey].abort();
          const ac = new AbortController();
          abortControllersRef.current[loadKey] = ac;
          try {
            const res = await fetch(buildOptionsUrl(bucketId, currentSkip, lastSearch), {
              headers: {authorization: `IDENTITY ${authToken}`},
              signal: ac.signal
            });
            if (!res.ok) return [];
            const data = await res.json();
            setRelationStates(prev => ({
              ...prev,
              [key]: {...prev[key], skip: currentSkip + 25}
            }));
            return data?.data?.map((i: any) => ({label: i.title, value: i._id})) || [];
          } catch (e: any) {
            if (e?.name === "AbortError") return [];
            throw e;
          } finally {
            delete abortControllersRef.current[loadKey];
          }
        };
      }

      if (!searchOptionsMap.current[key]) {
        searchOptionsMap.current[key] = async (search: string) => {
          const searchKey = `${key}_search`;
          setRelationStates(prev => ({...prev, [key]: {...prev[key], lastSearch: search}}));
          if (abortControllersRef.current[searchKey])
            abortControllersRef.current[searchKey].abort();
          const ac = new AbortController();
          abortControllersRef.current[searchKey] = ac;
          try {
            const res = await fetch(buildOptionsUrl(bucketId, 0, search), {
              headers: {authorization: `IDENTITY ${authToken}`},
              signal: ac.signal
            });
            if (!res.ok) return [];
            const data = await res.json();
            setRelationStates(prev => ({
              ...prev,
              [key]: {...prev[key], skip: 25, total: data?.meta?.total || 0}
            }));
            return data?.data?.map((i: any) => ({label: i.title, value: i._id})) || [];
          } catch (e: any) {
            if (e?.name === "AbortError") return [];
            throw e;
          } finally {
            delete abortControllersRef.current[searchKey];
          }
        };
      }
    },
    [authToken, relationStates]
  );

  return {relationStates, getOptionsMap, loadMoreOptionsMap, searchOptionsMap, ensureHandlers};
};

function mergeConstraints(from: any, into: any) {
  const keys = [
    "minimum",
    "maximum",
    "minItems",
    "maxItems",
    "pattern",
    "enum",
    // Do NOT copy complex children here; they are
    // constructed separately with generated ids.
    // "items", // intentionally omitted to prevent overwriting built child items
    // "properties", // intentionally omitted to prevent overwriting built child properties
    "relationType",
    "bucketId",
    "required",
    "default"
  ];
  for (const k of keys) {
    if (from?.[k] !== undefined) into[k] = from[k];
  }
}

export const useValueProperties = (bucket: BucketType, authToken: string) => {
  const {relationStates, getOptionsMap, loadMoreOptionsMap, searchOptionsMap, ensureHandlers} =
    useRelationHandlers(authToken);

  const buildProps = useCallback(
    (properties: Record<string, Property>, prefix = ""): Record<string, any> => {
      const output: Record<string, any> = {};
      for (const [key, prop] of Object.entries(properties || {})) {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        const kind = prop.type;
        const fieldDefinition = kind ? FIELD_REGISTRY[kind] : undefined;
        if (!fieldDefinition) {
          output[key] = {...prop, id: crypto.randomUUID()};
          continue;
        }
        let base;
        if (kind !== "relation") {
          base = fieldDefinition.buildValueProperty(prop);
        } else {
          ensureHandlers(prop.bucketId, fullKey);
          const relationProps = {
            getOptions: getOptionsMap.current[fullKey],
            loadMoreOptions: loadMoreOptionsMap.current[fullKey],
            searchOptions: searchOptionsMap.current[fullKey],
            totalOptionsLength: relationStates?.[fullKey]?.total || 0
          };
          base = fieldDefinition.buildValueProperty(prop, relationProps);
        }
        const withId = {...base, id: crypto.randomUUID()};

        // Recursively handle object child properties when present
        if (prop.type === "object" && prop.properties) {
          withId.properties = buildProps(prop.properties, fullKey);
        }

        // For arrays with object items, pass through as-is to preserve structure
        if (prop.type === "array" && prop.items?.type === "object") {
          withId.items = {
            ...base.items,
            type: prop.items.type ?? "object",
            properties: buildProps(prop.items.properties, `${fullKey}[]`)
          };
          mergeConstraints(prop.items, withId.items);
        } else if (prop.type === "array" && prop.items?.type) {
          mergeConstraints(prop.items, withId.items);
        }

        if (prop.type === "multiselect") {
          withId.enum = prop.items.enum || [];
        }

        // Carry over constraints/patterns to keep validation intact
        mergeConstraints(prop, withId);
        output[key] = withId;
      }
      return output;
    },
    [ensureHandlers, getOptionsMap, loadMoreOptionsMap, searchOptionsMap, relationStates]
  );

  const valueProperties = useMemo(
    () => buildProps(bucket.properties || {}, ""),
    [bucket.properties, buildProps]
  );

  return valueProperties;
};

export const useValidation = () => {
  const cleanValueRecursive = useCallback((val: any, property: Property): any => {
    if (property?.type === "object" && property.properties) {
      const cleanedObject = Object.fromEntries(
        Object.entries(val || {}).map(([k, v]) => [
          k,
          property.properties[k] ? cleanValueRecursive(v, property.properties[k]) : v
        ])
      );
      return cleanedObject;
    }
    return cleanValue(val, property?.type);
  }, []);

  const validateValues = useCallback(
    (
      value: Record<string, any>,
      formattedProperties: Record<string, Property>,
      requiredFields: string[]
    ) => {
      type FormError = {[key: string]: string | FormError | Record<number, any>};
      const errors: FormError = {};

      for (const [key, property] of Object.entries(formattedProperties || {})) {
        const val = value?.[key];
        const propertyWithRequired = {
          ...property,
          required: requiredFields?.includes(key) ? true : (property as any).required
        } as Property & {required?: boolean};

        if (property.type === "object" && property.properties) {
          const nestedRequired = (property as any).required || [];
          const nestedErrors = validateValues(
            val || {},
            property.properties,
            Array.isArray(nestedRequired) ? nestedRequired : []
          );
          if (nestedErrors && Object.keys(nestedErrors).length > 0) {
            errors[key] = nestedErrors as FormError;
          }
          continue;
        }

        if (property.type === "array") {
          const arrayDef = FIELD_REGISTRY[property.type as keyof typeof FIELD_REGISTRY];
          if (arrayDef?.validateValue) {
            const msg = arrayDef.validateValue(val, propertyWithRequired as any);
            if (msg) {
              errors[key] = msg;
              continue;
            }
          }

          const items = (property as any).items;
          if (Array.isArray(val) && items?.type) {
            if (items.type === "object" && items.properties) {
              const arrayErrors: string[] = [];
              const nestedRequired = Array.isArray((items as any).required)
                ? (items as any).required
                : [];
              for (let i = 0; i < val.length; i++) {
                const element = val[i] || {};
                const nestedErrors = validateValues(element, items.properties, nestedRequired);
                if (nestedErrors && Object.keys(nestedErrors).length > 0) {
                  // Transform nested errors to include index information
                  for (const [fieldName, fieldError] of Object.entries(nestedErrors)) {
                    if (typeof fieldError === 'string') {
                      arrayErrors.push(`${fieldName} at index ${i} ${fieldError.replace(/^this field /i, "").replace(/^This field /i, "")}`);
                    }
                  }
                }
              }
              if (arrayErrors.length > 0) {
                errors[key] = arrayErrors[0]; // Return the first error as a string
                continue;
              }
            }
          }
          continue;
        }

        const kind = property.type as keyof typeof FIELD_REGISTRY;
        const def = FIELD_REGISTRY[kind];
        if (def?.validateValue) {
          const msg = def.validateValue(val, propertyWithRequired);
          if (msg) errors[key] = msg as string;
        }
      }
      return Object.keys(errors).length > 0 ? errors : undefined;
    },
    []
  );

  return {cleanValueRecursive, validateValues};
};
