import {useState, useRef, useEffect, useCallback} from "react";
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
  initialFormattedValues?: FormattedInitialValue | FormattedInitialValue[];
  stateInitialized: boolean;
};

export type RelationInputHandlers = {
  relationStates: Record<string, RelationState>;
  getOptionsMap: React.RefObject<TypeGetOptionsMap>;
  loadMoreOptionsMap: React.RefObject<TypeGetMoreOptionsMap>;
  searchOptionsMap: React.RefObject<TypeSearchOptionsMap>;
  ensureHandlers: (bucketId: string, key: string, initialValue?: TypeInitialValues) => void;
};

export type TypeInitialValues =
  | string
  | string[]
  | FormattedInitialValue
  | Array<FormattedInitialValue>;

const buildQueryParams = (skip = 0, searchValue?: string, primaryKey?: string) => {
  const params: {
    paginate: boolean;
    relation: boolean;
    limit: number;
    sort: Record<string, number>;
    skip: number;
    filter?: Record<string, any>;
  } = {
    paginate: true,
    relation: true,
    limit: 25,
    sort: {_id: -1},
    skip
  };

  if (searchValue) {
    const searchField = primaryKey || "_id";
    params.filter = {
      $or: [
        {
          [searchField]: {$regex: searchValue, $options: "i"}
        }
      ]
    };
  }

  return params;
};

export const useRelationInputHandlers = (): RelationInputHandlers => {
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

  const getPrimaryKey = useCallback(
    async (bucketId: string, key: string) => {
      if (relationStatesRef.current[key]?.primaryKey)
        return relationStatesRef.current[key].primaryKey;
      if (!bucketId) return;
      try {
        const result = await getBucket(bucketId).unwrap();
        const bucketPrimaryKey = result?.primary;
        if (!bucketPrimaryKey) return;
        relationStatesRef.current[key] = {
          ...relationStatesRef.current[key],
          primaryKey: bucketPrimaryKey
        };
        setRelationStates(prev => ({
          ...prev,
          [key]: {...prev[key], primaryKey: bucketPrimaryKey, stateInitialized: false}
        }));
        return bucketPrimaryKey;
      } catch (e) {
        console.error("Failed to get primary key:", e);
        return undefined;
      }
    },
    [getBucket, relationStatesRef]
  );

  const populateGetOptions = useCallback(
    (bucketId: string, key: string) => {
      if (getOptionsMap.current[key]) return;

      getOptionsMap.current[key] = async () => {
        if (!bucketId) return [];
        const bucketPrimaryKey = await getPrimaryKey(bucketId, key);
        if (!bucketPrimaryKey) return [];
        try {
          const params = buildQueryParams(0, undefined, bucketPrimaryKey);
          const data = await getBucketData({bucketId, ...params}).unwrap();
          setRelationStates(prev => ({
            ...prev,
            [key]: {
              ...prev[key],
              skip: 25,
              total: data?.meta?.total || 0,
              lastSearch: "",
              primaryKey: bucketPrimaryKey
            }
          }));
          return (
            data?.data?.map((i: any) => ({
              label: i[bucketPrimaryKey],
              value: i._id
            })) || []
          );
        } catch (e) {
          console.error("Failed to get options:", e);
          return [];
        }
      };
    },
    [getBucketData, getPrimaryKey]
  );

  const populateLoadMoreOptions = useCallback(
    (bucketId: string, key: string) => {
      if (loadMoreOptionsMap.current[key]) return;
      loadMoreOptionsMap.current[key] = async () => {
        if (!bucketId) return [];
        const currentSkip = relationStatesRef.current?.[key]?.skip || 0;
        const lastSearch = relationStatesRef.current?.[key]?.lastSearch || "";
        const bucketPrimaryKey = await getPrimaryKey(bucketId, key);
        if (!bucketPrimaryKey) return [];

        try {
          const params = buildQueryParams(currentSkip, lastSearch, bucketPrimaryKey);
          const data = await getBucketData({bucketId, ...params}).unwrap();

          setRelationStates(prev => ({...prev, [key]: {...prev[key], skip: currentSkip + 25}}));

          return (
            data?.data?.map((i: any) => ({
              label: i[bucketPrimaryKey] ?? i.title,
              value: i._id
            })) || []
          );
        } catch (e) {
          console.error("Failed to load more options:", e);
          return [];
        }
      };
    },
    [getBucketData, getPrimaryKey]
  );

  const populateSearchOptions = useCallback(
    (bucketId: string, key: string) => {
      if (searchOptionsMap.current[key]) return;

      searchOptionsMap.current[key] = async (search: string) => {
        if (!bucketId) return [];
        const bucketPrimaryKey = await getPrimaryKey(bucketId, key);
        if (!bucketPrimaryKey) return [];
        setRelationStates(prev => ({...prev, [key]: {...prev[key], lastSearch: search}}));
        try {
          const params = buildQueryParams(0, search, bucketPrimaryKey);
          const data = await getBucketData({bucketId, ...params}).unwrap();
          setRelationStates(prev => ({
            ...prev,
            [key]: {...prev[key], skip: 25, total: data?.meta?.total || 0}
          }));
          return (
            data?.data?.map((i: any) => ({
              label: i[bucketPrimaryKey] ?? i.title,
              value: i._id
            })) || []
          );
        } catch (e) {
          console.error("Failed to search options:", e);
          return [];
        }
      };
    },
    [getBucketData, getPrimaryKey]
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
      if (Array.isArray(initialValue)) {
        const formattedValues: Array<{label: string; value: string}> = [];
        for (const val of initialValue) {
          try {
            const row = await getBucketEntry({bucketId, entryId: val as string}).unwrap();
            const formatted = {
              value: (row as any)?._id || "",
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
            value: (row as any)?._id || "",
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
      if (getOptionsMap.current[key]) return;
      getPrimaryKey(bucketId, key).then(() => {
        ensureInitialValueFormatting(bucketId, key, relationValue);
      });
      populateHandlers(bucketId, key);
    },
    [getPrimaryKey, populateHandlers]
  );

  return {relationStates, getOptionsMap, loadMoreOptionsMap, searchOptionsMap, ensureHandlers};
};
