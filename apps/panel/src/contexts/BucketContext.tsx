import {createContext, useMemo, useContext, type ReactNode, useEffect} from "react";
import {useBucketService} from "../services/bucketService";

type BucketContextType = {
  buckets: any; // Replace with actual type
  loading: boolean;
  error: string | null;
};

const BucketContext = createContext<BucketContextType | null>(null);

export const BucketProvider = ({children}: {children: ReactNode}) => {
  const {buckets, loading, error, fetchBuckets} = useBucketService();

  useEffect(() => {
    fetchBuckets();
  }, []);

  const contextValue = useMemo(
    () => ({
      buckets,
      loading,
      error
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