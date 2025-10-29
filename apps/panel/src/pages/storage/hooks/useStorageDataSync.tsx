import {useEffect} from "react";
import {useStorageData} from "./useStorageData";
import type {TypeDirectories} from "src/types/storage";
import {findMaxDepthDirectory} from "../utils";
import {useStorageConverter} from "./useStorageConverter";
import type {Storage} from "../../../store/api/storageApi";
import {SEARCH_RESULTS_PATH} from "./useDirectoryNavigation";
import {ROOT_PATH} from "../constants";

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
    if (!storageData) return;

    const convertedData = convertData(storageData as unknown as Storage[]);
    if (!convertedData) return;

    if (isFilteringOrSearching) {
      const convertedDataWithNoFolders = convertedData.filter(
        item => item.content.type !== "inode/directory"
      );
      const newDirectories: TypeDirectories = directory.map(i =>
        i.fullPath === ROOT_PATH
          ? {
              ...i,
              items: convertedDataWithNoFolders,
              currentDepth: 1
            }
          : {...i, currentDepth: undefined, isActive: false}
      );
      setDirectory(newDirectories);
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
  }, [storageData, isFilteringOrSearching]);

  return {isLoading};
}
