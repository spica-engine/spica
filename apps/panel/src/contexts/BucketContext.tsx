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
  updateBucketLimitation: (bucket: BucketType) => Promise<void>;
  updateBucketLimitationFields: (
    bucket: BucketType,
    countLimit: number,
    limitExceedBehaviour: "prevent" | "remove"
  ) => Promise<any>;
  buckets: BucketType[];
  bucketCategories: string[];
  bucketData: BucketDataType | null;
  bucketDataLoading: boolean;
  updateBucketLimitationFieldsLoading: boolean;
  updateBucketLimitationFieldsError: string | null;
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
    apiUpdatebucketLimitiation,
    apiUpdatebucketLimitiationFields,
    apiBuckets,
    apiBucketData,
    apiBucketDataLoading,
    apiUpdateBucketLimitationFieldsLoading,
    apiUpdateBucketLimitationFieldsError
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

  const updateBucketLimitation = useCallback(
    async (bucket: BucketType) => {
      const hasSettings = Boolean(bucket.documentSettings);
      const modifiedBucket: BucketType = hasSettings
        ? (({documentSettings, ...rest}) => rest)(bucket)
        : {
            ...bucket,
            documentSettings: {
              countLimit: 100,
              limitExceedBehaviour: "prevent"
            }
          };

      let previousBuckets: BucketType[] = [];
      setBuckets(prev => {
        previousBuckets = prev ?? [];
        return (prev ?? []).map(b => (b._id === bucket._id ? modifiedBucket : b));
      });

      const success = await apiUpdatebucketLimitiation(bucket._id, modifiedBucket);
      if (!success) {
        setBuckets(previousBuckets);
      }
    },
    [apiUpdatebucketLimitiation]
  );

  const updateBucketLimitationFields = useCallback(
    async (bucket: BucketType, countLimit: number, limitExceedBehaviour: "prevent" | "remove") => {
      const modifiedBucket = {
        ...bucket,
        documentSettings: {
          countLimit,
          limitExceedBehaviour
        }
      };
      const success = await apiUpdatebucketLimitiationFields(modifiedBucket);
      if (success) {
        setBuckets(prev =>
          prev ? prev.map(b => (b._id === bucket._id ? modifiedBucket : b)) : []
        );
      }
    },
    [apiUpdatebucketLimitiationFields]
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
      updateBucketLimitation,
      updateBucketLimitationFields,
      buckets,
      bucketData,
      bucketDataLoading: apiBucketDataLoading,
      bucketCategories,
      updateBucketLimitationFieldsLoading: apiUpdateBucketLimitationFieldsLoading,
      updateBucketLimitationFieldsError: apiUpdateBucketLimitationFieldsError,
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
      updateBucketLimitation,
      updateBucketLimitationFields,
      buckets,
      bucketData,
      apiBucketDataLoading,
      bucketCategories,
      apiUpdateBucketLimitationFieldsLoading,
      apiUpdateBucketLimitationFieldsError,
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
