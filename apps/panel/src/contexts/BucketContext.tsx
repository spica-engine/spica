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
  deleteBucketLoading: boolean;
  deleteBucketError: string | null;
  fetchBuckets: (params?: {
    body?: any;
    headers?: AxiosRequestHeaders;
    endpoint?: string;
  }) => Promise<any>;
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
    deleteBucketRequest,
    deleteBucketLoading,
    deleteBucketError,
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

  const deleteBucket = useCallback(
    (bucketId: string) => {
      setBuckets(prev => (prev ? prev.filter(i => i._id !== bucketId) : []));
      return deleteBucketRequest(bucketId);
    },
    [deleteBucketRequest]
  );

  const contextValue = useMemo(
    () => ({
      buckets,
      setBuckets,
      loading,
      error,
      deleteBucket,
      deleteBucketLoading,
      deleteBucketError,
      fetchBuckets,
      changeBucketOrder,
      bucketOrderLoading,
      bucketOrderError,
      currentBucket,
      getCurrentBucket,
      currentBucketLoading,
      currentBucketError
    }),
    [buckets, loading, error, deleteBucketLoading, deleteBucketError, fetchBuckets, currentBucket, currentBucketLoading, currentBucketError]
  );

  return <BucketContext.Provider value={contextValue}>{children}</BucketContext.Provider>;
};

export function useBucket() {
  const context = useContext(BucketContext);
  if (!context) throw new Error("useBucket must be used within an BucketProvider");
  return context;
}

export default BucketContext;
