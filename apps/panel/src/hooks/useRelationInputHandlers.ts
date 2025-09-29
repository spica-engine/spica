import {useState, useRef, useEffect, useCallback} from "react";

export type RelationState = {
  skip: number;
  total: number;
  lastSearch: string;
};

type Option = {label: string; value: string};

// This function also exists in one of other branches, but in a different file. 
// Make sure to delete this after it is merged to main, or delete it then import the function from here
const buildOptionsUrl = (bucketId: string, skip = 0, searchValue?: string) => {
  const baseUrl = import.meta.env.VITE_BASE_URL;
  const params = new URLSearchParams({
    paginate: "true",
    relation: "true",
    limit: "25",
    sort: JSON.stringify({_id: -1}),
    skip: String(skip)
  });

  if (searchValue) {
    const filter = {
      $or: [
        {
          title: {$regex: searchValue, $options: "i"}
        }
      ]
    };
    params.append("filter", JSON.stringify(filter));
  }

  return `${baseUrl}/api/bucket/${bucketId}/data?${params.toString()}`;
};

export const useRelationInputHandler = (
  authToken: string,
  bucketId: string,
  bucketPrimaryKey: string
) => {
  const [relationState, setRelationState] = useState<RelationState>({
    skip: 0,
    total: 0,
    lastSearch: ""
  });

  const relationStateRef = useRef(relationState);

  useEffect(() => {
    relationStateRef.current = relationState;
  }, [relationState]);

  const getOptions = useCallback(async (): Promise<Option[]> => {
    try {
      const res = await fetch(buildOptionsUrl(bucketId, 0), {
        headers: {authorization: `IDENTITY ${authToken}`}
      });
      if (!res.ok) return [];
      const data = await res.json();
      setRelationState({skip: 25, total: data?.meta?.total || 0, lastSearch: ""});
      return (
        data?.data?.map((i: {_id: string; [k: string]: any}) => ({
          label: i[bucketPrimaryKey],
          value: i._id
        })) || []
      );
    } catch (e) {
      throw e;
    }
  }, [authToken, bucketId, bucketPrimaryKey]);

  const loadMoreOptions = useCallback(async (): Promise<Option[]> => {
    const currentSkip = relationStateRef.current.skip || 0;
    const lastSearch = relationStateRef.current.lastSearch || "";

    try {
      const res = await fetch(buildOptionsUrl(bucketId, currentSkip, lastSearch), {
        headers: {authorization: `IDENTITY ${authToken}`}
      });
      if (!res.ok) return [];
      const data = await res.json();

      setRelationState(prev => ({...prev, skip: currentSkip + 25}));

      return (
        data?.data?.map((i: {title: string; _id: string}) => ({
          label: i.title,
          value: i._id
        })) || []
      );
    } catch (e) {
      throw e;
    }
  }, [authToken, bucketId]);

  const searchOptions = useCallback(
    async (search: string): Promise<Option[]> => {
      setRelationState(prev => ({...prev, lastSearch: search}));
      try {
        const res = await fetch(buildOptionsUrl(bucketId, 0, search), {
          headers: {authorization: `IDENTITY ${authToken}`}
        });
        if (!res.ok) return [];
        const data = await res.json();
        setRelationState(prev => ({
          ...prev,
          skip: 25,
          total: data?.meta?.total || 0
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
    },
    [authToken, bucketId]
  );

  return {relationState, getOptions, loadMoreOptions, searchOptions, totalOptionsLength: relationState.total};
};

export type RelationInputHandlerResult = Promise<Option[]>;

export const useRelationInputHandlers = (authToken: string) => {
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
