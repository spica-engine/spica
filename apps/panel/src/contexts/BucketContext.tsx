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
  cleanBucketData: () => void;
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
  createBucket: (title: string) => Promise<any>;
  buckets: BucketType[];
  bucketCategories: string[];
  bucketData: BucketDataWithIdType | null;
  bucketDataLoading: boolean;
  deleteBucketHistoryLoading: boolean;
  deleteBucketHistoryError: string | null;
  nextbucketDataQuery: BucketDataQueryWithIdType | null;
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
    apiCreateBucket,
    apiBuckets,
    apiBucketData,
    apiBucketDataLoading,
    apiDeleteBucketHistoryLoading,
    apiDeleteBucketHistoryError,
  } = useBucketService();

  const [lastUsedBucketDataQuery, setLastUsedBucketDataQuery] =
    useState<BucketDataQueryWithIdType | null>(null);
  const [bucketData, setBucketData] = useState<BucketDataWithIdType>({
    ...apiBucketData,
    bucketId: lastUsedBucketDataQuery?.bucketId as string
  } as BucketDataWithIdType);
  const [buckets, setBuckets] = useState<BucketType[]>(apiBuckets ?? []);
  useEffect(() => setBuckets(apiBuckets ?? []), [apiBuckets]);

  useEffect(() => {
    if (!apiBucketData) return;
    setBucketData(prev => {
      const fetchedBucketDataWithId = {
        ...apiBucketData,
        bucketId: lastUsedBucketDataQuery?.bucketId as string
      } as BucketDataWithIdType;
      if (!prev) return fetchedBucketDataWithId;

      const prevBucketId = prev.bucketId;
      const newBucketId = lastUsedBucketDataQuery?.bucketId;

      if (prevBucketId !== newBucketId) return fetchedBucketDataWithId;

      const existingIds = new Set(prev.data.map(item => item._id));

      const newItems = apiBucketData.data.filter(item => !existingIds.has(item.id));

      if (newItems.length === 0) return prev;
      return {...prev, data: [...prev.data, ...newItems]};
    });
  }, [JSON.stringify(lastUsedBucketDataQuery)]);

  const nextbucketDataQuery: BucketDataQueryWithIdType | null = useMemo(
    () => ({
      ...(lastUsedBucketDataQuery as BucketDataQueryWithIdType),
      skip: (lastUsedBucketDataQuery?.skip ?? 0) + 25
    }),
    [JSON.stringify(lastUsedBucketDataQuery)]
  );

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

  const getBucketData = useCallback(
    async (bucketId: string, query?: BucketDataQueryWithIdType) => {
      const {bucketId: _, ...prevQueryNoBucket} = lastUsedBucketDataQuery || {};
      const {bucketId: __, ...newQueryNoBucket} = query || {bucketId: ""};

      const previousQueryEmpty = Object.keys(prevQueryNoBucket).length <= 1;
      const newQueryEmpty = Object.keys(newQueryNoBucket).length <= 1;
      const queriesEqual = JSON.stringify(prevQueryNoBucket) === JSON.stringify(newQueryNoBucket);
      if (queriesEqual && !previousQueryEmpty && !newQueryEmpty) return;

      const defaultParams: Omit<BucketDataQueryType, "sort"> & {sort: string} = {
        paginate: true,
        relation: true,
        limit: 25,
        sort: JSON.stringify({_id: -1})
      };

      let params = newQueryNoBucket
        ? {
            ...defaultParams,
            ...newQueryNoBucket,
            sort: newQueryNoBucket.sort ? JSON.stringify(newQueryNoBucket.sort) : defaultParams.sort
          }
        : {...defaultParams};

      if (!params.sort || Object.keys(JSON.parse(params.sort)).length === 0) {
        const {sort, ...rest} = params;
        params = rest as typeof params;
      }

      const queryString = new URLSearchParams(
        params as unknown as Record<string, string>
      ).toString();

      return apiGetBucketData(bucketId, queryString).then(result => {
        if (!result) return;
        setLastUsedBucketDataQuery(
          newQueryNoBucket
            ? {...newQueryNoBucket, bucketId}
            : {...defaultParams, sort: {_id: -1}, bucketId}
        );
        return result;
      });
    },
    [apiGetBucketData]
  );

  const cleanBucketData = useCallback(() => {
    setBucketData({data: []} as unknown as BucketDataWithIdType);
  }, []);

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


  const createBucket = useCallback(
    async (title: string) => {
      return await apiCreateBucket(title, buckets.length).then(result => {
        if (!result) return
        setBuckets(prev => [...(prev ?? []), result]);
        return result;
      });
    },
    [buckets]
  );

  const contextValue = useMemo(
    () => ({
      getBucketData,
      cleanBucketData,
      getBuckets: apiGetBuckets,
      changeBucketCategory,
      updateBucketOrderLocally,
      updateBucketOrderOnServer: apiChangeBucketOrder,
      renameBucket,
      deleteBucket,
      updateBucketHistory,
      deleteBucketHistory: apiDeleteBucketHistory,
      createBucket,
      buckets,
      bucketData,
      bucketDataLoading: apiBucketDataLoading,
      bucketCategories,
      deleteBucketHistoryLoading: apiDeleteBucketHistoryLoading,
      deleteBucketHistoryError: apiDeleteBucketHistoryError,
      nextbucketDataQuery
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
      createBucket,
      buckets,
      bucketData,
      apiBucketDataLoading,
      bucketCategories,
      apiDeleteBucketHistoryLoading,
      apiDeleteBucketHistoryError,
      nextbucketDataQuery
    ]
  );

  return <BucketContext.Provider value={contextValue}>{children}</BucketContext.Provider>;
};

export function useBucket() {
  const context = useContext(BucketContext);
  if (!context) throw new Error("useBucket must be used within an BucketProvider");
  return context;
}

export default BucketContext;
