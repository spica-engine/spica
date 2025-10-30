import {useEffect, useMemo} from "react";
import {useLazyBrowseStorageQuery} from "../../../store/api/storageApi";
import type {TypeDirectories} from "../../../types/storage";
import {findMaxDepthDirectory} from "../utils";
import {ROOT_PATH} from "../constants";

export function useStorageData(directory: TypeDirectories) {
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
    fetchUnfilteredData({path});
  }, [fetchUnfilteredData, path]);

  return {
    storageData: unfilteredData,
    isLoading: isUnfilteredDataLoading || isUnfilteredDataFetching,
    error
  };
}
