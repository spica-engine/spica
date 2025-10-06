import { useGetStorageItemsQuery, useGetStorageItemQuery, type StorageOptions } from "../store/api";

export function useStorageData(options?: StorageOptions) {
  const query = useGetStorageItemsQuery(options || {});
  
  return {
    storageItems: query.data?.data || [],
    meta: query.data?.meta || { total: 0 },
    loading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

export function useStorageItem(id: string) {
  const query = useGetStorageItemQuery(id);
  
  return {
    storageItem: query.data,
    loading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}