import {
  createContext,
  useMemo,
  useContext,
  type ReactNode,
  useEffect,
  useState,
  useCallback
} from "react";
import {
  useBucketService,
  type BucketDataQueryType,
  type BucketDataQueryWithIdType,
  type BucketDataType,
  type BucketDataWithIdType,
  type BucketType
} from "../services/bucketService";
import type {AxiosRequestHeaders} from "axios";

type BucketContextType = {
  buckets: BucketType[];
  setBuckets: React.Dispatch<React.SetStateAction<BucketType[]>>;
  loading: boolean;
  error: string | null;
  deleteBucket: (bucketId: string) => Promise<any>;
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
  nextbucketDataQuery: BucketDataQueryWithIdType | null;
};

const BucketContext = createContext<BucketContextType | null>(null);
export const BucketProvider = ({children}: {children: ReactNode}) => {
  const {
    buckets: data,
    loading,
    error,
    fetchBuckets,
    bucketData: fetchedBucketData,
    getBucketData,
    lastUsedBucketDataQuery,
    deleteBucketRequest,
    changeBucketOrder,
    bucketOrderLoading,
    bucketOrderError
  } = useBucketService();
  const [bucketData, setBucketData] = useState<BucketDataWithIdType>({
    ...fetchedBucketData,
    bucketId: lastUsedBucketDataQuery?.bucketId as string
  } as BucketDataWithIdType);

  useEffect(() => {
    if (!fetchedBucketData) return;

    setBucketData(prev => {
      const fetchedBucketDataWithId = {
        ...fetchedBucketData,
        bucketId: lastUsedBucketDataQuery?.bucketId as string
      } as BucketDataWithIdType;
      if (!prev) return fetchedBucketDataWithId;

      const prevBucketId = prev.bucketId;
      const newBucketId = lastUsedBucketDataQuery?.bucketId;

      if (prevBucketId !== newBucketId) {
        return fetchedBucketDataWithId;
      }

      const existingIds = new Set(prev.data.map(item => item._id));

      const newItems = fetchedBucketData.data.filter(item => !existingIds.has(item.id));

      if (newItems.length === 0) return prev;
      return {...prev, data: [...prev.data, ...newItems]};
    });
  }, [JSON.stringify(lastUsedBucketDataQuery)]);

  const nextbucketDataQuery: BucketDataQueryWithIdType | null = useMemo(
    () => ({
      ...(lastUsedBucketDataQuery as BucketDataQueryWithIdType),
      skip: (lastUsedBucketDataQuery?.skip ?? 0) + 25
    }),
    [JSON.stringify(lastUsedBucketDataQuery)]
  );

  const [buckets, setBuckets] = useState<BucketType[]>(data ?? []);
  useEffect(() => setBuckets(data ?? []), [data]);

  const deleteBucket = useCallback(
    async (bucketId: string) => {
      try {
        await deleteBucketRequest(bucketId);
        setBuckets(prev => (prev ? prev.filter(i => i._id !== bucketId) : []));
      } catch (err) {
        console.error(err);
      }
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
      fetchBuckets,
      changeBucketOrder,
      bucketOrderLoading,
      bucketOrderError,
      bucketData,
      getBucketData,
      nextbucketDataQuery
    }),
    [
      buckets,
      loading,
      error,
      fetchBuckets,
      bucketData,
      getBucketData,
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
function BucketDataWithIdType(fetchedBucketData: BucketDataType | null) {
  throw new Error("Function not implemented.");
}
