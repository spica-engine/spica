import {useEffect, useMemo} from "react";
import {useLazyBrowseStorageQuery} from "../../../store/api/storageApi";
import type {TypeDirectories} from "../../../types/storage";
import {findMaxDepthDirectory} from "../utils";
import {ROOT_PATH} from "../constants";
import type {StorageFilterQuery} from "../../../utils/storageFilter";

export function useStorageData(directory: TypeDirectories, filterQuery: StorageFilterQuery | null) {
  const dirToFetch = findMaxDepthDirectory(directory) ?? directory[0];
  const [
    fetchUnfilteredData,
    {
      data: unfilteredData,
      isLoading: isUnfilteredDataLoading,
      isFetching: isUnfilteredDataFetching,
      error
    }
  ] = useLazyBrowseStorageQuery();

  const path = useMemo(() => {
    if (!dirToFetch) return "";
    if (dirToFetch.fullPath === ROOT_PATH) return "";

    return dirToFetch.fullPath.split("/").filter(Boolean).join("/");
  }, [dirToFetch?.fullPath]);

  useEffect(() => {
    const requestOptions: {path: string; filter?: StorageFilterQuery} = {path};
    if (filterQuery && Object.keys(filterQuery).length > 0) {
      requestOptions.filter = filterQuery;
    }
    fetchUnfilteredData(requestOptions);
  }, [fetchUnfilteredData, path, filterQuery]);

  return {
    storageData: unfilteredData,
    isLoading: isUnfilteredDataLoading || isUnfilteredDataFetching,
    error
  };
}
