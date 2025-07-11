import {createContext, useMemo, useContext, type ReactNode, useEffect} from "react";
import {useBucketService, type BucketType} from "../services/bucketService";

type BucketContextType = {
  buckets: BucketType[] | null;
  loading: boolean;
  error: string | null;
  deleteBucket: (bucketId: string) => Promise<any>;
  deleteBucketLoading: boolean;
  deleteBucketError: string | null;
};

const BucketContext = createContext<BucketContextType | null>(null);

export const BucketProvider = ({children}: {children: ReactNode}) => {
  const {
    buckets,
    loading,
    error,
    fetchBuckets,
    deleteBucket,
    deleteBucketLoading,
    deleteBucketError
  } = useBucketService();

  useEffect(() => {
    fetchBuckets();
  }, []);

  const contextValue = useMemo(
    () => ({
      buckets,
      loading,
      error,
      deleteBucket,
      deleteBucketLoading,
      deleteBucketError
    }),
    [buckets, loading, error]
  );

  return <BucketContext.Provider value={contextValue}>{children}</BucketContext.Provider>;
};

export function useBucket() {
  const context = useContext(BucketContext);
  if (!context) throw new Error("useBucket must be used within an BucketProvider");
  return context;
}

export default BucketContext;
