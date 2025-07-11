import {createContext, useMemo, useContext, type ReactNode, useEffect} from "react";
import {useBucketService, type BucketType} from "../services/bucketService";
import type {AxiosRequestHeaders} from "axios";

type BucketContextType = {
  buckets: BucketType[] | null;
  loading: boolean;
  error: string | null;
  changeBucketOrder: ({_id, index}: {_id: string; index: number}) => void;
};

const BucketContext = createContext<BucketContextType | null>(null);

export const BucketProvider = ({children}: {children: ReactNode}) => {
  const {
    buckets,
    loading,
    error,
    fetchBuckets,
    changeBucketOrder,
    bucketOrderLoading,
    bucketOrderError
  } = useBucketService();

  useEffect(() => {
    fetchBuckets();
  }, []);

  const contextValue = useMemo(
    () => ({
      buckets,
      loading,
      error,
      changeBucketOrder,
      bucketOrderLoading,
      bucketOrderError
    }),
    [buckets, loading, error, changeBucketOrder, bucketOrderLoading, bucketOrderError]
  );

  return <BucketContext.Provider value={contextValue}>{children}</BucketContext.Provider>;
};

export function useBucket() {
  const context = useContext(BucketContext);
  if (!context) throw new Error("useBucket must be used within an BucketProvider");
  return context;
}

export default BucketContext;
