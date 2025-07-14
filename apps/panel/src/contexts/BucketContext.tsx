import {createContext, useMemo, useContext, type ReactNode, useEffect} from "react";
import {useBucketService, type BucketType} from "../services/bucketService";

type BucketContextType = {
  buckets: BucketType[] | null;
  loading: boolean;
  error: string | null;
  categories: string[];
};

const BucketContext = createContext<BucketContextType | null>(null);

// Delete this
const mockCategories = ["Category1", "Category2", "Category3", "Category4", "Category5"];

export const BucketProvider = ({children}: {children: ReactNode}) => {
  const {buckets, loading, error, fetchBuckets} = useBucketService();

  useEffect(() => {
    fetchBuckets();
  }, []);

  const categories = useMemo(() => {
    if (!buckets) return [];
    const set = new Set<string>();
    buckets.forEach(bucket => {
      if (!bucket.category) return;
      set.add(bucket.category);
    });
    return [...Array.from(set), ...mockCategories];
  }, [buckets]);

  const contextValue = useMemo(
    () => ({
      buckets,
      loading,
      error,
      categories
    }),
    [buckets, loading, error, categories]
  );

  return <BucketContext.Provider value={contextValue}>{children}</BucketContext.Provider>;
};

export function useBucket() {
  const context = useContext(BucketContext);
  if (!context) throw new Error("useBucket must be used within an BucketProvider");
  return context;
}

export default BucketContext;
