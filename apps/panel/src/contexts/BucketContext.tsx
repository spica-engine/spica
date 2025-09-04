import {
  createContext,
  useMemo,
  useContext,
  type ReactNode,
  useEffect,
  useState,
  useCallback
} from "react";
import {
  useBucketService,
  type BucketDataQueryType,
  type BucketDataQueryWithIdType,
  type BucketDataType,
  type BucketDataWithIdType,
  type BucketType
} from "../services/bucketService";
import type {AxiosRequestHeaders} from "axios";

type BucketContextType = {
  getBucketData: (bucketId: string, query?: BucketDataQueryWithIdType) => Promise<BucketDataType>;
  loadMoreBucketData: () => Promise<void>;
  getBuckets: (params?: {
    body?: any;
    headers?: AxiosRequestHeaders;
    endpoint?: string;
  }) => Promise<BucketDataType>;
  changeBucketCategory: (bucketId: string, category: string) => Promise<any>;
  updateBucketOrderLocally: (from: number, to: number) => void;
  updateBucketOrderOnServer: (bucketId: string, order: number) => Promise<any>;
  renameBucket: (newTitle: string, bucket: BucketType) => void;
  deleteBucket: (bucketId: string) => Promise<any>;
  updateBucketHistory: (bucket: BucketType) => Promise<any>;
  deleteBucketHistory: (bucket: BucketType) => Promise<any>;
  refreshBucketData: () => Promise<void>;
  updateBucketReadonly: (bucket: BucketType) => Promise<any>;
  updateBucketRule: (
    bucket: BucketType,
    newRules: {
      read: string;
      write: string;
    }
  ) => Promise<any>;
  createBucketEntry: (bucketId: string, data: Record<string, any>) => Promise<any>;
  buckets: BucketType[];
  bucketCategories: string[];
  bucketData: BucketDataWithIdType | null;
  bucketDataLoading: boolean;
  deleteBucketHistoryLoading: boolean;
  deleteBucketHistoryError: string | null;
  updateBucketRuleLoading: boolean;
  updateBucketRuleError: string | null;
  createBucketEntryError: string | null;
};

/**
 * BucketContext: React Context managing bucket state and business logic.
 *
 * Naming conventions:
 * - Exposes domain-level functions for components (e.g., getBuckets, deleteBucket, renameBucket).
 * - Functions may orchestrate API calls AND update React state.
 * - No `api` prefix on functions here.
 * - Function names always start with a verb describing the action.
 * - Always include the entity name (e.g., Bucket, BucketItem) for clarity.
 *
 * Usage:
 * - Use `useBucket()` hook to access buckets and bucket-related actions.
 * - Keep context functions focused on state + side effects.
 * - API-only calls should be imported from useBucketService and named naturally here.
 */

const BucketContext = createContext<BucketContextType | null>(null);
export const BucketProvider = ({children}: {children: ReactNode}) => {
  const {
    apiGetBucketData,
    apiGetBuckets,
    apiChangeBucketCategory,
    apiChangeBucketOrder,
    apiRenameBucket,
    apiDeleteBucket,
    apiUpdateBucketHistory,
    apiDeleteBucketHistory,
    apiUpdateBucketReadonly,
    apiUpdateBucketRule,
    apiCreateBucketEntry,
    apiBuckets,
    apiUpdateBucketRuleError,
    apiUpdateBucketRuleLoading,
    apiBucketDataLoading,
    apiDeleteBucketHistoryLoading,
    apiDeleteBucketHistoryError,
    apiCreateBucketEntryError
  } = useBucketService();

  const [lastUsedBucketDataQuery, setLastUsedBucketDataQuery] =
    useState<BucketDataQueryWithIdType | null>(null);
  const [buckets, setBuckets] = useState<BucketType[]>(apiBuckets ?? []);
  useEffect(() => setBuckets(apiBuckets ?? []), [apiBuckets]);
  const [bucketData, setBucketData] = useState<BucketDataWithIdType>({
    data: []
  } as unknown as BucketDataWithIdType);

  const nextbucketDataQuery: BucketDataQueryWithIdType | null = useMemo(
    () =>
      lastUsedBucketDataQuery
        ? {
            ...lastUsedBucketDataQuery,
            skip: (lastUsedBucketDataQuery.skip ?? 0) + 25
          }
        : null,
    [lastUsedBucketDataQuery]
  );
  const getBucketData = useCallback(
    async (bucketId: string, query?: BucketDataQueryWithIdType) => {
      const defaultParams: Omit<BucketDataQueryType, "sort"> & {sort: string} = {
        paginate: true,
        relation: true,
        limit: 25,
        sort: JSON.stringify({_id: -1})
      };

      let params = query
        ? {
            ...defaultParams,
            ...query,
            sort: query.sort ? JSON.stringify(query.sort) : defaultParams.sort
          }
        : {...defaultParams};


      const queryString = new URLSearchParams(
        params as unknown as Record<string, string>
      ).toString();

      try {
        const result = await apiGetBucketData(bucketId, queryString);
        if (!result) return;

        setLastUsedBucketDataQuery(
          query ? {...query, bucketId} : {...defaultParams, sort: {_id: -1}, bucketId}
        );

        const newDataWithId = {
          ...result,
          bucketId
        } as BucketDataWithIdType;

        setBucketData(newDataWithId);

        return result;
      } catch (error) {
        console.error("Error getting bucket data:", error);
        throw error;
      }
    },
    [apiGetBucketData, setLastUsedBucketDataQuery]
  );

  const refreshBucketData = useCallback(async () => {
    if (!lastUsedBucketDataQuery?.bucketId) return;
    try {
      await getBucketData(lastUsedBucketDataQuery.bucketId, {
        ...lastUsedBucketDataQuery,
        skip: 0
      });
    } catch (error) {
      console.error("Error refreshing bucket data:", error);
    }
  }, [getBucketData, lastUsedBucketDataQuery]);

  const loadMoreBucketData = useCallback(async () => {
    if (!nextbucketDataQuery?.bucketId) return;
    const query = {
      ...nextbucketDataQuery,
      sort: nextbucketDataQuery.sort
        ? JSON.stringify(nextbucketDataQuery.sort)
        : JSON.stringify({_id: -1})
    };
    const {bucketId: _, ...prevQueryNoBucket} = query || {};
    const queryString = new URLSearchParams(
      prevQueryNoBucket as unknown as Record<string, string>
    ).toString();

    try {
      const result = await apiGetBucketData(nextbucketDataQuery.bucketId, queryString);
      if (!result) return;
      const existingIds = new Set(bucketData.data.map(item => item._id));
      const newItems = result.data.filter((item: {_id: string}) => !existingIds.has(item._id));
      const newData =
        newItems.length > 0 ? {...bucketData, data: [...bucketData.data, ...newItems]} : bucketData;
      setBucketData(newData);
      return result;
    } catch (error) {
      console.error("Error loading more bucket data:", error);
      throw error;
    }
  }, [nextbucketDataQuery]);

  const bucketCategories = useMemo(() => {
    if (!buckets) return [];
    const set = new Set<string>();
    buckets.forEach(bucket => {
      if (!bucket.category) return;
      set.add(bucket.category);
    });
    return Array.from(set);
  }, [buckets]);

  const changeBucketCategory = useCallback(
    async (bucketId: string, category: string) => {
      setBuckets(
        prev =>
          prev?.map(bucket => (bucket._id === bucketId ? {...bucket, category} : bucket)) ?? []
      );
      return await apiChangeBucketCategory(bucketId, category);
    },
    [apiChangeBucketCategory]
  );

  const deleteBucket = useCallback(
    async (bucketId: string) => {
      try {
        await apiDeleteBucket(bucketId);
        setBuckets(prev => (prev ? prev.filter(i => i._id !== bucketId) : []));
      } catch (err) {
        console.error(err);
      }
    },
    [apiDeleteBucket]
  );

  const updateBucketRule = useCallback(
    (bucket: BucketType, newRules: {read: string; write: string}) => {
      const oldBuckets = buckets;
      setBuckets(prev => prev.map(i => (i._id === bucket._id ? {...i, acl: newRules} : i)));
      return apiUpdateBucketRule(bucket, newRules).then(result => {
        if (!result) setBuckets(oldBuckets);
        return result;
      });
    },
    [apiUpdateBucketRule, buckets]
  );

  const renameBucket = useCallback(
    async (newTitle: string, bucket: BucketType) => {
      const oldBuckets = buckets;
      apiRenameBucket(newTitle, bucket).then(result => {
        if (!result) setBuckets(oldBuckets);
      });
      setBuckets(prev => prev.map(i => (i._id === bucket._id ? {...i, title: newTitle} : i)));
    },
    [buckets, apiRenameBucket]
  );

  const updateBucketOrderLocally = useCallback(
    (from: number, to: number) =>
      setBuckets(prev => {
        const updated = [...prev];
        const [moved] = updated.splice(from, 1);
        updated.splice(to, 0, moved);
        return updated;
      }),
    []
  );

  const updateBucketHistory = useCallback(
    async (bucket: BucketType) => {
      const previousBuckets = buckets;
      setBuckets(prev => (prev ? prev.map(i => ({...i, history: !i.history})) : []));
      return apiUpdateBucketHistory(bucket).then(result => {
        if (!result) {
          setBuckets(previousBuckets);
        }
        return result;
      });
    },
    [buckets]
  );


  const updateBucketReadonly = useCallback(async (bucket: BucketType) => {
    const previousBuckets = buckets;
    setBuckets(prev => (prev ? prev.map(i => ({...i, readOnly: !i.readOnly})) : []));
    const success = await apiUpdateBucketReadonly(bucket);
    if (!success) {
      setBuckets(previousBuckets);
    }
  }, [buckets, apiUpdateBucketReadonly]);

  const createBucketEntry = useCallback(
    async (bucketId: string, data: Record<string, any>) => {
      try {
        const result = await apiCreateBucketEntry(bucketId, data);
        if (!result) return;
        refreshBucketData();
        return result;
      } catch (error) {
        console.error("Error creating bucket entry:", error);
        throw error;
      }
    },
    [apiCreateBucketEntry, refreshBucketData]
  );

  const contextValue = useMemo(
    () => ({
      getBucketData,
      loadMoreBucketData,
      getBuckets: apiGetBuckets,
      changeBucketCategory,
      updateBucketOrderLocally,
      updateBucketOrderOnServer: apiChangeBucketOrder,
      renameBucket,
      deleteBucket,
      updateBucketHistory,
      deleteBucketHistory: apiDeleteBucketHistory,
      updateBucketRule,
      refreshBucketData,
      updateBucketReadonly,
      createBucketEntry,
      buckets,
      bucketData,
      updateBucketRuleLoading: apiUpdateBucketRuleLoading,
      updateBucketRuleError: apiUpdateBucketRuleError,
      bucketDataLoading: apiBucketDataLoading,
      bucketCategories,
      deleteBucketHistoryLoading: apiDeleteBucketHistoryLoading,
      deleteBucketHistoryError: apiDeleteBucketHistoryError,
      nextbucketDataQuery,
      createBucketEntryError: apiCreateBucketEntryError
    }),
    [
      getBucketData,
      apiGetBuckets,
      changeBucketCategory,
      updateBucketOrderLocally,
      apiChangeBucketOrder,
      renameBucket,
      deleteBucket,
      updateBucketHistory,
      apiDeleteBucketHistory,
      updateBucketRule,
      refreshBucketData,
      loadMoreBucketData,
      updateBucketReadonly,
      createBucketEntry,
      buckets,
      bucketData,
      apiUpdateBucketRuleLoading,
      apiUpdateBucketRuleError,
      apiBucketDataLoading,
      bucketCategories,
      apiDeleteBucketHistoryLoading,
      apiDeleteBucketHistoryError,
      nextbucketDataQuery,
      apiCreateBucketEntryError,
    ]
  );

  return <BucketContext value={contextValue}>{children}</BucketContext>;
};

export function useBucket() {
  const context = useContext(BucketContext);
  if (!context) throw new Error("useBucket must be used within an BucketProvider");
  return context;
}

export default BucketContext;
