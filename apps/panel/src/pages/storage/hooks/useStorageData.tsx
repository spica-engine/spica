import {useEffect, useMemo} from "react";
import {useLazyBrowseStorageQuery, useLazyGetStorageItemsQuery} from "../../../store/api/storageApi";
import type {TypeDirectories} from "../../../types/storage";
import {findMaxDepthDirectory} from "../utils";
import {ROOT_PATH} from "../constants";
import type {StorageFilterQuery} from "../../../utils/storageFilter";

export function useStorageData(directory: TypeDirectories, filterQuery: StorageFilterQuery | null) {
  const dirToFetch = findMaxDepthDirectory(directory) ?? directory[0];
  const [
    fetchBrowseData,
    {
      data: browseData,
      isLoading: isBrowseLoading,
      isFetching: isBrowseFetching,
      error: browseError
    }
  ] = useLazyBrowseStorageQuery();
  const [
    fetchFilteredData,
    {
      data: filteredData,
      isLoading: isFilteredLoading,
      isFetching: isFilteredFetching,
      error: filteredError
    }
  ] = useLazyGetStorageItemsQuery();

  const path = useMemo(() => {
    if (!dirToFetch) return "";
    if (dirToFetch.fullPath === ROOT_PATH) return "";

    return dirToFetch.fullPath.split("/").filter(Boolean).join("/");
  }, [dirToFetch?.fullPath]);

  const hasFilter = Boolean(filterQuery && Object.keys(filterQuery).length > 0);

  useEffect(() => {
    if (hasFilter && filterQuery) {
      fetchFilteredData({filter: filterQuery, paginate: false});
      return;
    }

    fetchBrowseData({path});
  }, [fetchBrowseData, fetchFilteredData, hasFilter, path, filterQuery]);

  const storageData = hasFilter ? filteredData : browseData;
  const isLoading = hasFilter
    ? isFilteredLoading || isFilteredFetching
    : isBrowseLoading || isBrowseFetching;
  const error = hasFilter ? filteredError : browseError;

  return {
    storageData,
    isLoading,
    error
  };
}
