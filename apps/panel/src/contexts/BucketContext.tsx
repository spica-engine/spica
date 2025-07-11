import {createContext, useMemo, useContext, type ReactNode, useEffect, useState} from "react";
import {useBucketService, type BucketType} from "../services/bucketService";

type BucketContextType = {
  buckets: BucketType[] | null;
  setBuckets: React.Dispatch<React.SetStateAction<BucketType[] | null>>;
  loading: boolean;
  error: string | null;
  changeBucketOrder: ({bucketId, order}: {bucketId: string; order: number}) => void;
  bucketOrderLoading: boolean;
  bucketOrderError: string | null;
};

const BucketContext = createContext<BucketContextType | null>(null);
export const BucketProvider = ({children}: {children: ReactNode}) => {
  const {loading, error, fetchBuckets, changeBucketOrder, bucketOrderLoading, bucketOrderError} =
    useBucketService();

  const [buckets, setBuckets] = useState<BucketType[] | null>(null);

  useEffect(() => {
    fetchBuckets().then(result => {
      if (!result) return;
      setBuckets(result);
    });
  }, []);

  const contextValue = useMemo(
    () => ({
      buckets,
      setBuckets,
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
