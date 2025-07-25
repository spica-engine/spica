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
};

const BucketContext = createContext<BucketContextType | null>(null);
export const BucketProvider = ({children}: {children: ReactNode}) => {
  const {
    buckets: data,
    loading,
    error,
    fetchBuckets,
    requestCategoryChange,
    currentBucket,
    currentBucketLoading,
    currentBucketError,
    getCurrentBucket,
    changeBucketOrder,
    bucketOrderLoading,
    bucketOrderError
  } = useBucketService();
  const [buckets, setBuckets] = useState<BucketType[]>(data ?? []);

  useEffect(() => setBuckets(data ?? []), [data]);

  const changeCategory = useCallback(
    (bucketId: string, category: string) => {
      setBuckets(prev =>
        prev
          ? prev.map(i => {
              if (i._id === bucketId) return {...i, category};
              return i;
            })
          : []
      );
      return requestCategoryChange(bucketId, category);
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

  useEffect(() => {
    fetchBuckets().then(result => {
      setBuckets(result);
    });
  }, []);

  const contextValue = useMemo(
    () => ({
      buckets,
      setBuckets,
      loading,
      error,
      fetchBuckets,
      categories,
      changeCategory,
      changeBucketOrder,
      bucketOrderLoading,
      bucketOrderError,
      currentBucket,
      getCurrentBucket,
      currentBucketLoading,
      currentBucketError
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
