import {useState, useRef, useEffect, useCallback} from "react";
import {useEngine} from "./useEngine";
import {keyOf} from "../utils/recordKey";
import {relationSearchFilter, relationTarget, relationValueId} from "../domain/relationTarget";
import type {DataEngine} from "../store/api/statusApi";
import type {FilterInput} from "../utils/serializeFilter";
import {
  useLazyGetBucketQuery,
  useLazyGetBucketDataQuery,
  useLazyGetBucketEntryQuery
} from "../store/api/bucketApi";

type Option = {label: string; value: string};

export type RelationInputHandlerResult = Promise<Option[]>;

export type getOptionsHandler = () => RelationInputHandlerResult;
export type loadMoreOptionsHandler = () => RelationInputHandlerResult;
export type searchOptionsHandler = (s: string) => RelationInputHandlerResult;

export type TypeGetMoreOptionsMap = Record<string, loadMoreOptionsHandler>;
export type TypeSearchOptionsMap = Record<string, searchOptionsHandler>;
export type TypeGetOptionsMap = Record<string, getOptionsHandler>;

type FormattedInitialValue = {_id: string; label: string} | {value: string; label: string};

export type RelationState = {
  skip: number;
  total: number;
  lastSearch: string;
  primaryKey: string;
  keyField: string;
  initialFormattedValues?: FormattedInitialValue | FormattedInitialValue[];
  stateInitialized: boolean;
};

export type RelationInputHandlers = {
  relationStates: Record<string, RelationState>;
  getOptionsMap: React.RefObject<TypeGetOptionsMap>;
  loadMoreOptionsMap: React.RefObject<TypeGetMoreOptionsMap>;
  searchOptionsMap: React.RefObject<TypeSearchOptionsMap>;
  ensureHandlers: (bucketId: string, key: string, initialValue?: TypeInitialValues) => void;
  initRelationValue: (bucketId: string, key: string, value: TypeInitialValues) => void;
};

export type TypeInitialValues =
  | string
  | string[]
  | FormattedInitialValue
  | Array<FormattedInitialValue>;

const buildQueryParams = (
  engine: DataEngine | undefined,
  target: {keyField: string; labelField?: string},
  skip = 0,
  searchValue?: string
) => {
  const params: {
    paginate: boolean;
    relation: boolean;
    limit: number;
    sort: Record<string, number>;
    skip: number;
    filter?: FilterInput;
  } = {
    paginate: true,
    relation: true,
    limit: 25,
    sort: {[target.keyField]: -1},
    skip
  };

  const filter = relationSearchFilter(engine, target.labelField, searchValue);
  if (filter) {
    params.filter = filter;
  }

  return params;
};

export const useRelationInputHandlers = (): RelationInputHandlers => {
  const engine = useEngine();
  const [relationStates, setRelationStates] = useState<Record<string, RelationState>>({});
  const relationStatesRef = useRef(relationStates);

  useEffect(() => {
    relationStatesRef.current = relationStates;
  }, [relationStates]);

  const getOptionsMap = useRef<TypeGetOptionsMap>({});
  const loadMoreOptionsMap = useRef<TypeGetMoreOptionsMap>({});
  const searchOptionsMap = useRef<TypeSearchOptionsMap>({});

  const [getBucket] = useLazyGetBucketQuery();
  const [getBucketData] = useLazyGetBucketDataQuery();
  const [getBucketEntry] = useLazyGetBucketEntryQuery();

  const getTarget = useCallback(
    async (bucketId: string, key: string) => {
      const known = relationStatesRef.current[key];
      if (known?.keyField && known?.primaryKey) {
        return {
          keyField: known.keyField,
          labelField: known.primaryKey === known.keyField ? undefined : known.primaryKey
        };
      }
      if (!bucketId || !engine) return;
      try {
        const result = await getBucket(bucketId).unwrap();
        const target = relationTarget(engine, result);
        if (!target) return;
        const labelField = target.labelField ?? (engine === "postgresql" ? target.keyField : undefined);
        if (!labelField) return;
        relationStatesRef.current[key] = {
          ...relationStatesRef.current[key],
          primaryKey: labelField,
          keyField: target.keyField
        };
        setRelationStates(prev => ({
          ...prev,
          [key]: {...prev[key], primaryKey: labelField, keyField: target.keyField, stateInitialized: false}
        }));
        return target;
      } catch (e) {
        console.error("Failed to get primary key:", e);
        return undefined;
      }
    },
    [getBucket, relationStatesRef, engine]
  );

  const populateGetOptions = useCallback(
    (bucketId: string, key: string) => {
      if (getOptionsMap.current[key]) return;

      getOptionsMap.current[key] = async () => {
        if (!bucketId) return [];
        const target = await getTarget(bucketId, key);
        if (!target) return [];
        const displayField = target.labelField ?? target.keyField;
        try {
          const params = buildQueryParams(engine, target);
          const data = await getBucketData({bucketId, ...params}).unwrap();
          setRelationStates(prev => ({
            ...prev,
            [key]: {
              ...prev[key],
              skip: 25,
              total: data?.meta?.total || 0,
              lastSearch: "",
              primaryKey: displayField,
              keyField: target.keyField
            }
          }));
          return (
            data?.data?.map((i: any) => ({
              label: String(i[displayField] ?? ""),
              value: keyOf(i, target.keyField)
            })) || []
          );
        } catch (e) {
          console.error("Failed to get options:", e);
          return [];
        }
      };
    },
    [getBucketData, getTarget, engine]
  );

  const populateLoadMoreOptions = useCallback(
    (bucketId: string, key: string) => {
      if (loadMoreOptionsMap.current[key]) return;
      loadMoreOptionsMap.current[key] = async () => {
        if (!bucketId) return [];
        const currentSkip = relationStatesRef.current?.[key]?.skip || 0;
        const lastSearch = relationStatesRef.current?.[key]?.lastSearch || "";
        const target = await getTarget(bucketId, key);
        if (!target) return [];
        const displayField = target.labelField ?? target.keyField;

        try {
          const params = buildQueryParams(engine, target, currentSkip, lastSearch);
          const data = await getBucketData({bucketId, ...params}).unwrap();

          setRelationStates(prev => ({...prev, [key]: {...prev[key], skip: currentSkip + 25}}));

          return (
            data?.data?.map((i: any) => ({
              label: String(i[displayField] ?? i.title ?? ""),
              value: keyOf(i, target.keyField)
            })) || []
          );
        } catch (e) {
          console.error("Failed to load more options:", e);
          return [];
        }
      };
    },
    [getBucketData, getTarget, engine]
  );

  const populateSearchOptions = useCallback(
    (bucketId: string, key: string) => {
      if (searchOptionsMap.current[key]) return;

      searchOptionsMap.current[key] = async (search: string) => {
        if (!bucketId) return [];
        const target = await getTarget(bucketId, key);
        if (!target) return [];
        const displayField = target.labelField ?? target.keyField;
        setRelationStates(prev => ({...prev, [key]: {...prev[key], lastSearch: search}}));
        try {
          const params = buildQueryParams(engine, target, 0, search);
          const data = await getBucketData({bucketId, ...params}).unwrap();
          setRelationStates(prev => ({
            ...prev,
            [key]: {...prev[key], skip: 25, total: data?.meta?.total || 0}
          }));
          return (
            data?.data?.map((i: any) => ({
              label: String(i[displayField] ?? i.title ?? ""),
              value: keyOf(i, target.keyField)
            })) || []
          );
        } catch (e) {
          console.error("Failed to search options:", e);
          return [];
        }
      };
    },
    [getBucketData, getTarget, engine]
  );

  const populateHandlers = useCallback(
    (bucketId: string, key: string) => {
      populateGetOptions(bucketId, key);
      populateLoadMoreOptions(bucketId, key);
      populateSearchOptions(bucketId, key);
    },
    [populateGetOptions, populateLoadMoreOptions, populateSearchOptions]
  );

  const ensureInitialValueFormatting = useCallback(
    async (bucketId: string, key: string, initialValue?: TypeInitialValues) => {
      const objectAlreadyFormattedByCaller =
        typeof initialValue === "object" && Object.keys(initialValue).toString() === "value";
      const arrayAlreadyFormattedByCaller =
        Array.isArray(initialValue) &&
        (initialValue.length === 0 || initialValue.every(i => typeof i !== "string"));

      if (!initialValue || objectAlreadyFormattedByCaller || arrayAlreadyFormattedByCaller) {
        setRelationStates(prev => ({
          ...prev,
          [key]: {...prev[key], stateInitialized: true}
        }));
        return initialValue;
      }

      const hasStoredFormattedInitialValues =
        relationStatesRef.current[key]?.initialFormattedValues;

      if (hasStoredFormattedInitialValues) {
        return initialValue;
      }

      let formattedValue: {label: string; value: string} | Array<{label: string; value: string}> | undefined = undefined;
      const primaryKey = relationStatesRef.current[key]?.primaryKey;
      const relatedKeyField = relationStatesRef.current[key]?.keyField;
      if (Array.isArray(initialValue)) {
        const formattedValues: Array<{label: string; value: string}> = [];
        for (const val of initialValue) {
          try {
            const row = await getBucketEntry({bucketId, entryId: val as string}).unwrap();
            const formatted = {
              value: keyOf(row as any, relatedKeyField),
              label: primaryKey ? (row as any)?.[primaryKey] || "" : ""
            };
            formattedValues.push(formatted);
          } catch (error) {
            console.error("Failed to fetch row data:", error);
          }
        }
        formattedValue = formattedValues;
      } else {
        try {
          const row = await getBucketEntry({bucketId, entryId: initialValue as string}).unwrap();
          formattedValue = {
            value: keyOf(row as any, relatedKeyField),
            label: primaryKey ? (row as any)?.[primaryKey] || "" : ""
          };
        } catch (error) {
          console.error("Failed to fetch row data:", error);
          formattedValue = undefined;
        }
      }
      setRelationStates(prev => ({
        ...prev,
        [key]: {...prev[key], initialFormattedValues: formattedValue, stateInitialized: true}
      }));
    },
    [getBucketEntry, relationStatesRef, setRelationStates]
  );
  const ensureHandlers = useCallback(
    (bucketId: string, key: string, relationValue?: TypeInitialValues) => {
      if (!engine || getOptionsMap.current[key]) return;
      getTarget(bucketId, key).then(() => {
        ensureInitialValueFormatting(bucketId, key, relationValue);
      });
      populateHandlers(bucketId, key);
    },
    [getTarget, populateHandlers, engine]
  );

  const initRelationValue = useCallback(
    (bucketId: string, key: string, value: TypeInitialValues) => {
      // Clear stale cached label so ensureInitialValueFormatting re-fetches it
      setRelationStates(prev => ({
        ...prev,
        [key]: {...prev[key], initialFormattedValues: undefined, stateInitialized: false}
      }));
      if (!engine) return;
      getTarget(bucketId, key).then(target => {
        if (!target) return;
        const primaryKey = target.labelField ?? target.keyField;

        // When the row was fetched with relation=true the API returns the full related
        // document, not just the ID string. Build initialFormattedValues directly from
        // that object without an extra getBucketEntry round-trip.
        const buildFromRow = (obj: any): {value: string; label: string} | null => {
          const id = relationValueId(obj, target.keyField);
          if (!id) return null;
          return {value: id, label: String(obj[primaryKey] ?? obj.label ?? "")};
        };

        if (value && typeof value === "object" && !Array.isArray(value)) {
          const formatted = buildFromRow(value);
          if (formatted) {
            setRelationStates(prev => ({
              ...prev,
              [key]: {...prev[key], initialFormattedValues: formatted, stateInitialized: true}
            }));
            return;
          }
        }

        if (Array.isArray(value)) {
          if (value.length === 0) {
            setRelationStates(prev => ({
              ...prev,
              [key]: {...prev[key], stateInitialized: true}
            }));
            return;
          }
          if (typeof value[0] === "object" && relationValueId(value[0], target.keyField)) {
            const formatted = (value as any[]).map(buildFromRow).filter(Boolean) as Array<{value: string; label: string}>;
            setRelationStates(prev => ({
              ...prev,
              [key]: {...prev[key], initialFormattedValues: formatted, stateInitialized: true}
            }));
            return;
          }
        }

        // Plain string ID(s) — normalize and let ensureInitialValueFormatting fetch the label
        let normalizedValue: string | string[] | undefined;
        if (typeof value === "string") {
          normalizedValue = value;
        } else if (Array.isArray(value)) {
          normalizedValue = (value as any[])
            .map((i: any) => relationValueId(i, target.keyField))
            .filter(Boolean) as string[];
        } else if (value && typeof value === "object") {
          normalizedValue = relationValueId(value, target.keyField);
        }

        if (normalizedValue) {
          ensureInitialValueFormatting(bucketId, key, normalizedValue);
        }
      });
    },
    [getTarget, ensureInitialValueFormatting, engine]
  );

  return {relationStates, getOptionsMap, loadMoreOptionsMap, searchOptionsMap, ensureHandlers, initRelationValue};
};
