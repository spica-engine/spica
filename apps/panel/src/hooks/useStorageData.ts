import { useGetStorageItemsQuery, useGetStorageItemQuery, type StorageOptions } from "../store/api";

interface UseStorageDataOptions {
  storageOptions?: StorageOptions;
  queryOptions?: {
    refetchOnMountOrArgChange?: boolean | number;
    refetchOnFocus?: boolean;
    skip?: boolean;
  };
}

export function useStorageData(options?: StorageOptions, queryOptions?: UseStorageDataOptions['queryOptions']) {
  const query = useGetStorageItemsQuery(options || {}, {
    refetchOnMountOrArgChange: 10,
    refetchOnFocus: true,
    ...queryOptions,
  });
  
  return {
    storageItems: query.data?.data || [],
    meta: query.data?.meta || { total: 0 },
    loading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

export function useStorageItem(id: string, queryOptions?: UseStorageDataOptions['queryOptions']) {
  const query = useGetStorageItemQuery(id, {
    refetchOnMountOrArgChange: 10,
    refetchOnFocus: true,
    ...queryOptions,
  });
  
  return {
    storageItem: query.data,
    loading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}