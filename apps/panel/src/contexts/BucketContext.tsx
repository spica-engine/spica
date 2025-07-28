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
  changeBucketOrder: (bucketId: string, order: number) => void;
  bucketOrderLoading: boolean;
  bucketOrderError: string | null;
  currentBucket: BucketType | null;
  getCurrentBucket: (bucketId: string) => Promise<any>;
  currentBucketLoading: boolean;
  currentBucketError: string | null;
  changeBucketName: (newTitle: string, bucket: BucketType) => Promise<any>;
};

const BucketContext = createContext<BucketContextType | null>(null);
export const BucketProvider = ({children}: {children: ReactNode}) => {
  const {
    loading,
    error,
    fetchBuckets,
    currentBucket,
    currentBucketLoading,
    currentBucketError,
    getCurrentBucket,
    changeBucketOrder,
    bucketOrderLoading,
    bucketOrderError,
    requestBucketNameChange
  } = useBucketService();

  const [buckets, setBuckets] = useState<BucketType[]>([]);

  const changeBucketName = useCallback(async (newTitle: string, bucket: BucketType) => {
    try {
      await requestBucketNameChange(newTitle, bucket);
      setBuckets(prev => prev.map(i => (i._id === bucket._id ? {...i, title: newTitle} : i)));
    } catch (err) {
      console.error(err);
    }
  }, []);

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
      changeBucketOrder,
      bucketOrderLoading,
      bucketOrderError,
      currentBucket,
      getCurrentBucket,
      currentBucketLoading,
      currentBucketError,
      changeBucketName
    }),
    [
      buckets,
      loading,
      error,
      fetchBuckets,
      currentBucket,
      currentBucketLoading,
      currentBucketError,
      changeBucketName
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
