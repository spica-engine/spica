import {useState, useRef, useEffect, useCallback} from "react";

export type RelationState = {
  skip: number;
  total: number;
  lastSearch: string;
  primaryKey: string;
};

type Option = {label: string; value: string};

const buildOptionsUrl = (bucketId: string, skip = 0, searchValue?: string, primaryKey?: string) => {
  const baseUrl = import.meta.env.VITE_BASE_URL;
  const params = new URLSearchParams({
    paginate: "true",
    relation: "true",
    limit: "25",
    sort: JSON.stringify({_id: -1}),
    skip: String(skip)
  });

  if (searchValue) {
    const searchField = primaryKey || "title";
    const filter = {
      $or: [
        {
          [searchField]: {$regex: searchValue, $options: "i"}
        }
      ]
    };
    params.append("filter", JSON.stringify(filter));
  }

  return `${baseUrl}/api/bucket/${bucketId}/data?${params.toString()}`;
};

export type RelationInputHandlerResult = Promise<Option[]>;

export type getOptionsHandler = () => RelationInputHandlerResult;
export type loadMoreOptionsHandler = () => RelationInputHandlerResult;
export type searchOptionsHandler = (s: string) => RelationInputHandlerResult;

type TypeGetMoreOptionsMap = Record<string, loadMoreOptionsHandler>;
type TypeSearchOptionsMap = Record<string, searchOptionsHandler>;
type TypeGetOptionsMap = Record<string, getOptionsHandler>;

export type RelationInputHandlers = {
  relationStates: Record<string, RelationState>;
  getOptionsMap: React.RefObject<TypeGetOptionsMap>;
  loadMoreOptionsMap: React.RefObject<TypeGetMoreOptionsMap>;
  searchOptionsMap: React.RefObject<TypeSearchOptionsMap>;
  ensureHandlers: (bucketId: string, key: string) => void;
};

export const useRelationInputHandlers = (authToken: string): RelationInputHandlers => {
  const [relationStates, setRelationStates] = useState<Record<string, RelationState>>({});
  const relationStatesRef = useRef(relationStates);

  useEffect(() => {
    relationStatesRef.current = relationStates;
  }, [relationStates]);

  const getOptionsMap = useRef<TypeGetOptionsMap>({});
  const loadMoreOptionsMap = useRef<TypeGetMoreOptionsMap>({});
  const searchOptionsMap = useRef<TypeSearchOptionsMap>({});

  const getPrimaryKey = useCallback(
    async (bucketId: string, key: string) => {
      if (relationStatesRef.current[key]?.primaryKey)
        return relationStatesRef.current[key].primaryKey;
      if (!bucketId) return;
      try {
        const res = await fetch(`${import.meta.env.VITE_BASE_URL}/api/bucket/${bucketId}`, {
          headers: {authorization: `IDENTITY ${authToken}`}
        });
        if (!res.ok) return;
        const data = await res.json();
        const bucketPrimaryKey = data?.primary;
        if (!bucketPrimaryKey) return;
        // update both ref and state so consumers re-render with the primary key
        relationStatesRef.current[key] = {
          ...relationStatesRef.current[key],
          primaryKey: bucketPrimaryKey
        };
        setRelationStates(prev => ({...prev, [key]: {...prev[key], primaryKey: bucketPrimaryKey}}));
        return bucketPrimaryKey;
      } catch (e) {
        throw e;
      }
    },
    [authToken, relationStatesRef]
  );

  const populateGetOptions = useCallback(
    (bucketId: string, key: string) => {
      if (getOptionsMap.current[key]) return;

      // Always create a function that will ensure primary key exists before fetching.
      getOptionsMap.current[key] = async () => {
        if (!bucketId) return [];
        // make sure we have primary key (may trigger network request)
        const bucketPrimaryKey = await getPrimaryKey(bucketId, key);
        if (!bucketPrimaryKey) return [];
        try {
          const res = await fetch(buildOptionsUrl(bucketId, 0, undefined, bucketPrimaryKey), {
            headers: {authorization: `IDENTITY ${authToken}`}
          });
          if (!res.ok) return [];
          const data = await res.json();
          setRelationStates(prev => ({
            ...prev,
            [key]: {
              skip: 25,
              total: data?.meta?.total || 0,
              lastSearch: "",
              primaryKey: bucketPrimaryKey
            }
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
    },
    [authToken]
  );

  const populateLoadMoreOptions = useCallback(
    (bucketId: string, key: string) => {
      if (loadMoreOptionsMap.current[key]) return;
      loadMoreOptionsMap.current[key] = async () => {
        console.log("loadMoreOptions for", key, bucketId, relationStatesRef.current[key]);
        if (!bucketId) return [];
        const currentSkip = relationStatesRef.current?.[key]?.skip || 0;
        const lastSearch = relationStatesRef.current?.[key]?.lastSearch || "";
        const bucketPrimaryKey = await getPrimaryKey(bucketId, key);
        if (!bucketPrimaryKey) return [];

        try {
          const res = await fetch(
            buildOptionsUrl(bucketId, currentSkip, lastSearch, bucketPrimaryKey),
            {
              headers: {authorization: `IDENTITY ${authToken}`}
            }
          );
          if (!res.ok) return [];
          const data = await res.json();

          setRelationStates(prev => ({...prev, [key]: {...prev[key], skip: currentSkip + 25}}));

          return (
            data?.data?.map((i: {[k: string]: any; _id: string}) => ({
              label: i[bucketPrimaryKey] ?? i.title,
              value: i._id
            })) || []
          );
        } catch (e) {
          throw e;
        }
      };
    },
    [authToken]
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
          const res = await fetch(buildOptionsUrl(bucketId, 0, search, bucketPrimaryKey), {
            headers: {authorization: `IDENTITY ${authToken}`}
          });
          if (!res.ok) return [];
          const data = await res.json();
          setRelationStates(prev => ({
            ...prev,
            [key]: {...prev[key], skip: 25, total: data?.meta?.total || 0}
          }));
          return (
            data?.data?.map((i: {[k: string]: any; _id: string}) => ({
              label: i[bucketPrimaryKey] ?? i.title,
              value: i._id
            })) || []
          );
        } catch (e) {
          throw e;
        }
      };
    },
    [authToken]
  );

  const populateHandlers = useCallback(
    (bucketId: string, key: string) => {
      populateGetOptions(bucketId, key);
      populateLoadMoreOptions(bucketId, key);
      populateSearchOptions(bucketId, key);
    },
    [populateGetOptions, populateLoadMoreOptions, populateSearchOptions]
  );

  const ensureHandlers = useCallback(
    (bucketId: string, key: string) => {
      if (getOptionsMap.current[key]) return;
      getPrimaryKey(bucketId, key);
      populateHandlers(bucketId, key);
    },
    [getPrimaryKey, populateHandlers]
  );

  return {relationStates, getOptionsMap, loadMoreOptionsMap, searchOptionsMap, ensureHandlers};
};
