import {createContext, useMemo, useContext, type ReactNode, useEffect} from "react";
import {useBucketService, type BucketType} from "../services/bucketService";

type BucketContextType = {
  buckets: BucketType[] | null;
  loading: boolean;
  error: string | null;
  categories: string[];
  changeCategory: (bucketId: string, category: string) => Promise<any>
};

const BucketContext = createContext<BucketContextType | null>(null);

export const BucketProvider = ({children}: {children: ReactNode}) => {
  const {buckets, loading, error, fetchBuckets, changeCategory} = useBucketService();

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
    return Array.from(set);
  }, [buckets]);

  const contextValue = useMemo(
    () => ({
      buckets,
      loading,
      error,
      categories,
      changeCategory,
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
