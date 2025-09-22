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
  type BucketType,
  type Property
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
  createBucket: (title: string) => Promise<any>;
  createBucketField: (
    bucket: BucketType,
    newField: Property,
    requiredField?: string,
    primaryField?: string
  ) => Promise<any>;
  updateCellData: (value: any, title: string, id: string) => Promise<any>;
  updateBucketLimitation: (bucket: BucketType) => Promise<void>;
  updateBucketLimitationFields: (
    bucket: BucketType,
    countLimit: number,
    limitExceedBehaviour: "prevent" | "remove"
  ) => Promise<void>;
  buckets: BucketType[];
  bucketCategories: string[];
  bucketData: BucketDataWithIdType | null;
  bucketDataLoading: boolean;
  updateBucketLimitationFieldsLoading: boolean;
  updateBucketLimitationFieldsError: string | null;
  deleteBucketHistoryLoading: boolean;
  deleteBucketHistoryError: string | null;
  updateBucketRuleLoading: boolean;
  updateBucketRuleError: string | null;
  createBucketFieldError: string | null;
  updateCellDataError: string | null;
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
    apiCreateBucket,
    apiCreateBucketField,
    apiUpdateCellData,
    apiUpdatebucketLimitiation,
    apiUpdatebucketLimitiationFields,
    apiBuckets,
    apiUpdateBucketRuleError,
    apiUpdateBucketRuleLoading,
    apiBucketDataLoading,
    apiDeleteBucketHistoryLoading,
    apiDeleteBucketHistoryError,
    apiCreateBucketFieldError,
    apiUpdateBucketLimitationFieldsLoading,
    apiUpdateCellDataError,
    apiUpdateBucketLimitationFieldsError
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

  const updateBucketReadonly = useCallback(
    async (bucket: BucketType) => {
      const previousBuckets = buckets;
      setBuckets(prev => (prev ? prev.map(i => ({...i, readOnly: !i.readOnly})) : []));
      const success = await apiUpdateBucketReadonly(bucket);
      if (!success) {
        setBuckets(previousBuckets);
      }
    },
    [buckets, apiUpdateBucketReadonly]
  );

  const createBucketField = useCallback(
    async (
      bucket: BucketType,
      newField: Property,
      requiredField?: string,
      primaryField?: string
    ) => {
      const currentRequired = bucket.required ? [...bucket.required] : [];
      if (requiredField) currentRequired.push(requiredField);
      const modifiedBucket = {
        ...bucket,
        properties: {...bucket.properties, [newField.title]: newField},
        required: currentRequired.length > 0 ? currentRequired : [],
        primary: primaryField ?? bucket.primary
      };
      return apiCreateBucketField(modifiedBucket).then(result => {
        apiGetBuckets();
        return result;
      });
    },
    [apiCreateBucketField]
  );

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

  const createBucket = useCallback(
    async (title: string) => {
      return await apiCreateBucket(title, buckets.length).then(result => {
        if (!result) return;
        setBuckets(prev => [...(prev ?? []), result]);
        return result;
      });
    },
    [buckets, apiCreateBucket]
  );
  const updateCellData = useCallback(
    async (value: any, title: string, id: string) => {
      const oldBucketData = bucketData;

      const index = bucketData.data.findIndex(row => row._id === id);
      if (index === -1) return;

      const newData = bucketData.data.map((row, i) =>
        i === index ? {...row, [title]: value} : row
      );

      setBucketData({...bucketData, data: newData});

      const result = await apiUpdateCellData(value, title, id, bucketData.bucketId);
      if (!result) {
        setBucketData(oldBucketData);
      }
      return result;
    },
    [apiUpdateCellData, bucketData]
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
      updateBucketLimitation,
      updateBucketLimitationFields,
      createBucket,
      createBucketField,
      buckets,
      bucketData,
      updateBucketRuleLoading: apiUpdateBucketRuleLoading,
      updateBucketRuleError: apiUpdateBucketRuleError,
      bucketDataLoading: apiBucketDataLoading,
      bucketCategories,
      deleteBucketHistoryLoading: apiDeleteBucketHistoryLoading,
      deleteBucketHistoryError: apiDeleteBucketHistoryError,
      updateBucketLimitationFieldsLoading: apiUpdateBucketLimitationFieldsLoading,
      updateBucketLimitationFieldsError: apiUpdateBucketLimitationFieldsError,
      updateCellData,
      nextbucketDataQuery,
      createBucketFieldError: apiCreateBucketFieldError,
      updateCellDataError: apiUpdateCellDataError
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
      updateBucketLimitation,
      updateBucketLimitationFields,
      updateBucketLimitation,
      updateBucketLimitationFields,
      createBucket,
      createBucketField,
      buckets,
      bucketData,
      apiUpdateBucketRuleLoading,
      apiUpdateBucketRuleError,
      apiBucketDataLoading,
      bucketCategories,
      apiDeleteBucketHistoryLoading,
      apiDeleteBucketHistoryError,
      apiUpdateBucketLimitationFieldsLoading,
      apiUpdateBucketLimitationFieldsError,
      updateCellData,
      apiUpdateBucketLimitationFieldsLoading,
      apiUpdateBucketLimitationFieldsError,
      nextbucketDataQuery,
      apiCreateBucketFieldError,
      apiUpdateCellDataError
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
