import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import type {BucketType, Property} from "src/services/bucketService";
import {FIELD_REGISTRY} from "../../../domain/fields/registry";
import {buildOptionsUrl} from "./NewBucketEntryPopupUtils";
import type {TypeArrayItems} from "oziko-ui-kit/dist/custom-hooks/useInputRepresenter";

type RelationState = {
  skip: number;
  total: number;
  lastSearch: string;
};

type RelationInputHandlerResult = Promise<{label: string; value: string}[]>;

const useRelationInputHandlers = (authToken: string) => {
  const [relationStates, setRelationStates] = useState<Record<string, RelationState>>({});
  const relationStatesRef = useRef(relationStates);

  useEffect(() => {
    relationStatesRef.current = relationStates;
  }, [relationStates]);

  const getOptionsMap = useRef<Record<string, () => RelationInputHandlerResult>>({});
  const loadMoreOptionsMap = useRef<Record<string, () => RelationInputHandlerResult>>({});
  const searchOptionsMap = useRef<Record<string, (s: string) => RelationInputHandlerResult>>({});

  const ensureHandlers = useCallback(
    (bucketId: string, key: string, bucketPrimaryKey: string) => {
      if (!getOptionsMap.current[key]) {
        getOptionsMap.current[key] = async () => {
          try {
            const res = await fetch(buildOptionsUrl(bucketId, 0), {
              headers: {authorization: `IDENTITY ${authToken}`}
            });
            if (!res.ok) return [];
            const data = await res.json();
            setRelationStates(prev => ({
              ...prev,
              [key]: {skip: 25, total: data?.meta?.total || 0, lastSearch: ""}
            }));
            return (
              data?.data?.map((i: {_id: string; [key: string]: any}) => ({
                label: i[bucketPrimaryKey],
                value: i._id
              })) || []
            );
          } catch (e) {
            throw e;
          }
        };
      }

      if (!loadMoreOptionsMap.current[key]) {
        loadMoreOptionsMap.current[key] = async () => {
          const currentSkip = relationStatesRef.current?.[key]?.skip || 0;
          const lastSearch = relationStatesRef.current?.[key]?.lastSearch || "";

          try {
            const res = await fetch(buildOptionsUrl(bucketId, currentSkip, lastSearch), {
              headers: {authorization: `IDENTITY ${authToken}`}
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
          } catch (e) {
            throw e;
          }
        };
      }

      if (!searchOptionsMap.current[key]) {
        searchOptionsMap.current[key] = async (search: string) => {
          setRelationStates(prev => ({...prev, [key]: {...prev[key], lastSearch: search}}));
          try {
            const res = await fetch(buildOptionsUrl(bucketId, 0, search), {
              headers: {authorization: `IDENTITY ${authToken}`}
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
          } catch (e) {
            throw e;
          }
        };
      }
    },
    [authToken, relationStates]
  );

  return {relationStates, getOptionsMap, loadMoreOptionsMap, searchOptionsMap, ensureHandlers};
};

export const useValueProperties = (
  bucket: BucketType,
  authToken: string,
  primaryKeys: Record<string, string>
) => {
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
        ensureHandlers(prop.bucketId, key, primaryKeys[prop.bucketId]);
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
        if (prop?.[k as string] !== undefined) {
          withId[k] = prop[k as string];
        }
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
