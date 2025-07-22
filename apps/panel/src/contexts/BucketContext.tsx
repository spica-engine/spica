import {createContext, useMemo, useContext, type ReactNode, useEffect, useState} from "react";
import {
  useBucketService,
  type BucketDataQueryType,
  type BucketDataType,
  type BucketType
} from "../services/bucketService";
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
  }) => Promise<BucketDataType>;
  changeBucketOrder: (bucketId: string, order: number) => void;
  bucketOrderLoading: boolean;
  bucketOrderError: string | null;
  bucketData: BucketDataType | null;
  getBucketData: (bucketId: string, query?: BucketDataQueryType) => Promise<BucketDataType>;
  bucketDataLoading: boolean;
  bucketDataError: string | null;
  nextbucketDataQuery: any;
};

const BucketContext = createContext<BucketContextType | null>(null);
export const BucketProvider = ({children}: {children: ReactNode}) => {
  const {
    loading,
    error,
    fetchBuckets,
    bucketData: fetchedBucketData,
    bucketDataLoading,
    bucketDataError,
    getBucketData,
    lastUsedBucketDataQuery,
    changeBucketOrder,
    bucketOrderLoading,
    bucketOrderError
  } = useBucketService();
  const [bucketData, setBucketData] = useState(fetchedBucketData);

  useEffect(() => {
    if (!fetchedBucketData || bucketDataError) return;

    setBucketData(prev => {
      if (!prev) return fetchedBucketData;

      const existingIds = new Set(prev.data.map(item => item._id));
      const newItems = fetchedBucketData.data.filter(item => !existingIds.has(item.id));
      if (newItems.length === 0) return prev;
      return {...prev, data: [...prev.data, ...newItems]};
    });
  }, [JSON.stringify(lastUsedBucketDataQuery)]);

  const nextbucketDataQuery: {
    paginate?: boolean;
    relation?: boolean;
    limit?: number;
    sort?: Record<string, number>;
    skip?: number;
  } = useMemo(
    () => ({...lastUsedBucketDataQuery, skip: (lastUsedBucketDataQuery?.skip ?? 0) + 25}),
    [JSON.stringify(lastUsedBucketDataQuery)]
  );

  const [buckets, setBuckets] = useState<BucketType[]>([]);

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
      bucketData,
      getBucketData,
      bucketDataLoading,
      bucketDataError,
      nextbucketDataQuery
    }),
    [
      buckets,
      loading,
      error,
      fetchBuckets,
      bucketData,
      getBucketData,
      bucketDataLoading,
      bucketDataError,
      nextbucketDataQuery
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
