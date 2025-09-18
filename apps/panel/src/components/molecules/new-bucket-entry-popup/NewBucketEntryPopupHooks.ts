import {useCallback, useMemo, useRef, useState} from "react";
import type {BucketType, Property} from "src/services/bucketService";
import {FIELD_REGISTRY} from "../../../domain/fields/registry";
import {buildOptionsUrl, cleanValue} from "./NewBucketEntryPopupUtils";
import type {TypeArrayItems} from "oziko-ui-kit/build/dist/custom-hooks/useInputRepresenter";

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
            return (
              data?.data?.map((i: {title: string; _id: string}) => ({
                label: i.title,
                value: i._id
              })) || []
            );
          } catch (e: unknown) {
            if ((e as Error)?.name === "AbortError") return [];
            throw e;
          } finally {
            delete abortControllersRef.current[key];
          }
        };
      }

      if (!loadMoreOptionsMap.current[key]) {
        loadMoreOptionsMap.current[key] = async () => {
          // Use a ref to get current state values
          let currentSkip = 0;
          let lastSearch = "";

          setRelationStates(prev => {
            const currentState = prev[key] || {};
            currentSkip = currentState.skip || 0;
            lastSearch = currentState.lastSearch || "";
            return prev; // Return unchanged to avoid triggering re-render
          });

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

            return (
              data?.data?.map((i: {title: string; _id: string}) => ({
                label: i.title,
                value: i._id
              })) || []
            );
          } catch (e: unknown) {
            if ((e as Error)?.name === "AbortError") return [];
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
            return (
              data?.data?.map((i: {title: string; _id: string}) => ({
                label: i.title,
                value: i._id
              })) || []
            );
          } catch (e: unknown) {
            if ((e as Error)?.name === "AbortError") return [];
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

function mergeConstraints(from: Property | TypeArrayItems, into: Property | TypeArrayItems) {
  const keys = [
    "minimum",
    "maximum",
    "minItems",
    "maxItems",
    "pattern",
    "enum",
    "relationType",
    "bucketId",
    "required",
    "default"
  ] as (keyof (Property | TypeArrayItems))[];
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
        } else if (prop.type === "array" && prop.items?.type && withId.items) {
          mergeConstraints(prop.items, withId.items);
        }

        if (prop.type === "multiselect") {
          withId.enum = prop.items.enum || [];
        }

        // Carry over constraints/patterns to keep validation intact
        mergeConstraints(prop, withId as Property);
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
          required: requiredFields?.includes(key) ? true : property.required
        };
        const kind = property.type;
        const field = FIELD_REGISTRY[kind];
        const msg = field?.validateValue(val, propertyWithRequired);
        if (msg) errors[key] = msg as string;
      }
      return Object.keys(errors).length > 0 ? errors : undefined;
    },
    []
  );

  return {validateValues};
};
