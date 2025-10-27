import type {TypeFile} from "oziko-ui-kit";
import {useEffect} from "react";
import {useStorageData} from "./useStorageData";
import type {TypeDirectories} from "src/types/storage";
import {findMaxDepthDirectory} from "../utils";
import {useStorageConverter} from "./useStorageConverter";
import { INITIAL_DIRECTORIES } from "../constants";

export function useStorageDataSync(
  apiFilter: object = {},
  directory: TypeDirectories,
  setDirectory: (dirs: TypeDirectories) => void,
  searchQuery: string = "",
  isFilteringOrSearching: boolean = false
) {
  const {storageData, isLoading} = useStorageData(
    directory,
    apiFilter,
    searchQuery,
    isFilteringOrSearching
  );
  const {convertData} = useStorageConverter(directory);

  useEffect(() => {
    const data = storageData?.data ?? (storageData as unknown as TypeFile[]);
    const convertedData = convertData(data as TypeFile[]);
    if (!convertedData) return;
    if (convertedData.length === 0 && isFilteringOrSearching) {
      setDirectory(INITIAL_DIRECTORIES);
      return;
    }
    let newDirectories = [...directory];
    const dirToChange = findMaxDepthDirectory(newDirectories) ?? newDirectories[0];
    if (dirToChange) {
      newDirectories = newDirectories.map(i =>
        i.fullPath === dirToChange.fullPath ? {...i, items: convertedData} : i
      );
    }
    setDirectory(newDirectories);
  }, [storageData]);

  return {isLoading};
}