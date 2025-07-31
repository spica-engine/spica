import {
  createContext,
  useMemo,
  useContext,
  type ReactNode,
  useEffect,
  useState,
  useCallback
} from "react";
import {useBucketService, type BucketType} from "../services/bucketService";
import type {AxiosRequestHeaders} from "axios";

type BucketContextType = {
  buckets: BucketType[];
  setBuckets: React.Dispatch<React.SetStateAction<BucketType[]>>;
  loading: boolean;
  error: string | null;
  deleteBucket: (bucketId: string) => Promise<any>;
  fetchBuckets: (params?: {
    body?: any;
    headers?: AxiosRequestHeaders;
    endpoint?: string;
  }) => Promise<any>;
  categories: string[];
  changeCategory: (bucketId: string, category: string) => Promise<any>;
  changeBucketOrder: (bucketId: string, order: number) => void;
  bucketOrderLoading: boolean;
  bucketOrderError: string | null;
  currentBucket: BucketType | null;
  getCurrentBucket: (bucketId: string) => Promise<any>;
  currentBucketLoading: boolean;
  currentBucketError: string | null;
  changeBucketRule: (
    bucket: BucketType,
    newRules: {
      read: string;
      write: string;
    }
  ) => Promise<any>;

  bucketRuleChangeLoading: boolean;
};

const BucketContext = createContext<BucketContextType | null>(null);
export const BucketProvider = ({children}: {children: ReactNode}) => {
  const {
    buckets: data,
    loading,
    error,
    fetchBuckets,
    requestCategoryChange,
    deleteBucketRequest,
    currentBucket,
    currentBucketLoading,
    currentBucketError,
    getCurrentBucket,
    changeBucketOrder,
    bucketOrderLoading,
    bucketOrderError,
    changeBucketRuleRequest,
    bucketRuleChangeLoading
  } = useBucketService();
  const [buckets, setBuckets] = useState<BucketType[]>(data ?? []);

  useEffect(() => setBuckets(data ?? []), [data]);

  const changeCategory = useCallback(
    async (bucketId: string, category: string) => {
      setBuckets(
        prev =>
          prev?.map(bucket => (bucket._id === bucketId ? {...bucket, category} : bucket)) ?? []
      );
      return await requestCategoryChange(bucketId, category);
    },
    [requestCategoryChange]
  );

  const categories = useMemo(() => {
    if (!buckets) return [];
    const set = new Set<string>();
    buckets.forEach(bucket => {
      if (!bucket.category) return;
      set.add(bucket.category);
    });
    return Array.from(set);
  }, [buckets]);

  const deleteBucket = useCallback(
    async (bucketId: string) => {
      try {
        await deleteBucketRequest(bucketId);
        setBuckets(prev => (prev ? prev.filter(i => i._id !== bucketId) : []));
      } catch (err) {
        console.error(err);
      }
    },
    [deleteBucketRequest]
  );

  const changeBucketRule = useCallback(
    (bucket: BucketType, newRules: {read: string; write: string}) => {
      return changeBucketRuleRequest(bucket, newRules).then(result => {
        if (!result) return;
        setBuckets(prev => prev.map(i => (i._id === bucket._id ? {...i, acl: newRules} : i)));
      });
    },
    []
  );

  const contextValue = useMemo(
    () => ({
      buckets,
      setBuckets,
      loading,
      error,
      deleteBucket,
      fetchBuckets,
      categories,
      changeCategory,
      changeBucketOrder,
      bucketOrderLoading,
      bucketOrderError,
      currentBucket,
      getCurrentBucket,
      currentBucketLoading,
      currentBucketError,
      changeBucketRule,
      bucketRuleChangeLoading
    }),
    [
      buckets,
      loading,
      error,
      fetchBuckets,
      categories,
      currentBucket,
      currentBucketLoading,
      currentBucketError
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
