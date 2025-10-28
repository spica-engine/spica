import {useMemo} from "react";
import {useBrowseStorageQuery} from "../../../store/api/storageApi";
import type {TypeDirectories} from "../../../types/storage";
import {findMaxDepthDirectory} from "../utils";
import {ROOT_PATH} from "../constants";

export function useStorageData(directory: TypeDirectories) {
  const dirToFetch = findMaxDepthDirectory(directory) ?? directory[0];

  const path = useMemo(() => {
    if (!dirToFetch) return "";
    if (dirToFetch.fullPath === ROOT_PATH) return "";

    return dirToFetch.fullPath.split("/").filter(Boolean).join("/");
  }, [dirToFetch?.fullPath]);

  const {
    data: storageData,
    isLoading,
    error
  } = useBrowseStorageQuery({
    path,
    sort: {name: 1}
  });

  return {
    storageData,
    isLoading,
    error
  };
}
