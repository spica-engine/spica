import { useMemo } from "react";
import { useGetStorageItemsQuery } from "../../../store/api";
import type { TypeDirectories } from "src/types/storage";
import useStorage from "../../../hooks/useStorage";
import { findMaxDepthDirectory } from "../utils";

export function useStorageData(directory: TypeDirectories) {
  const {buildDirectoryFilter} = useStorage();

  const filterArray = [
    "/",
    ...(findMaxDepthDirectory(directory)
      ?.fullPath.split("/")
      .filter(Boolean)
      .map(i => `${i}/`) || [])
  ];

  const directoryFilter = useMemo(() => buildDirectoryFilter(filterArray), [filterArray]);

  const {data: storageData} = useGetStorageItemsQuery({filter: directoryFilter});

  return {storageData};
}