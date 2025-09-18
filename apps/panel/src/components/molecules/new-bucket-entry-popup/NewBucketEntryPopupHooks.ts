import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import type {BucketType, Property} from "src/services/bucketService";
import {FIELD_REGISTRY} from "../../../domain/fields/registry";
import {buildOptionsUrl} from "./NewBucketEntryPopupUtils";
import type {TypeArrayItems} from "oziko-ui-kit/build/dist/custom-hooks/useInputRepresenter";

type RelationState = {
  skip: number;
  total: number;
  lastSearch: string;
};

const useRelationInputHandlers = (authToken: string) => {
  const [relationStates, setRelationStates] = useState<Record<string, RelationState>>({});
  const relationStatesRef = useRef(relationStates);

  useEffect(() => {
    relationStatesRef.current = relationStates;
  }, [relationStates]);

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
          const currentSkip = relationStatesRef.current?.[key]?.skip || 0;
          const lastSearch = relationStatesRef.current?.[key]?.lastSearch || "";

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

export const useValueProperties = (bucket: BucketType, authToken: string) => {
  const {relationStates, getOptionsMap, loadMoreOptionsMap, searchOptionsMap, ensureHandlers} =
    useRelationInputHandlers(authToken);

  const valueProperties = useMemo(() => {
    const properties = bucket?.properties || {};
    const output: Record<string, any> = {};
    for (const [key, prop] of Object.entries(properties || {})) {
      const kind = prop.type;
      const fieldDefinition = kind ? FIELD_REGISTRY[kind] : undefined;
      if (!fieldDefinition) {
        output[key] = {...prop, id: crypto.randomUUID()};
        continue;
      }
      let base;
      if (kind === "relation") {
        ensureHandlers(prop.bucketId, key);
        const relationProps = {
          getOptions: getOptionsMap.current[key],
          loadMoreOptions: loadMoreOptionsMap.current[key],
          searchOptions: searchOptionsMap.current[key],
          totalOptionsLength: relationStates?.[key]?.total || 0
        };
        base = fieldDefinition.buildValueProperty(prop, relationProps);
      } else {
        base = fieldDefinition.buildValueProperty(prop);
      }
      const withId = {...base, id: crypto.randomUUID()};

      if (prop.type === "multiselect") {
        withId.enum = prop.items.enum || [];
      }

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
        if (prop?.[k] !== undefined) withId[k] = prop[k];
      }
      output[key] = withId;
    }

    return output;
  }, [
    bucket.properties,
    ensureHandlers,
    getOptionsMap,
    loadMoreOptionsMap,
    searchOptionsMap,
    relationStates
  ]);

  return valueProperties;
};