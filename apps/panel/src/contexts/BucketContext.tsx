import {createContext, useMemo, useContext, type ReactNode, useEffect, useState} from "react";
import {useBucketService, type BucketType} from "../services/bucketService";

type BucketContextType = {
  buckets: BucketType[] | null;
  loading: boolean;
  error: string | null;
  currentBucket: BucketType | null;
  getCurrentBucket: (bucketId: string) => Promise<any>;
  currentBucketLoading: boolean;
  currentBucketError: string | null;
};

const BucketContext = createContext<BucketContextType | null>(null);

export const BucketProvider = ({children}: {children: ReactNode}) => {
  const {
    buckets,
    loading,
    error,
    fetchBuckets,
    currentBucket,
    currentBucketLoading,
    currentBucketError,
    getCurrentBucket,
  } = useBucketService();

  useEffect(() => {
    fetchBuckets();
  }, []);

  const contextValue = useMemo(
    () => ({
      buckets,
      loading,
      error,
      currentBucket,
      getCurrentBucket,
      currentBucketLoading,
      currentBucketError
    }),
    [buckets, loading, error, currentBucket, currentBucketLoading, currentBucketError]
  );

  return <BucketContext.Provider value={contextValue}>{children}</BucketContext.Provider>;
};

export function useBucket() {
  const context = useContext(BucketContext);
  if (!context) throw new Error("useBucket must be used within an BucketProvider");
  return context;
}

export default BucketContext;
