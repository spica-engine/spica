import type {TypeFile} from "oziko-ui-kit";
import {useEffect} from "react";
import {useStorageData} from "./useStorageData";
import type {TypeDirectories} from "src/types/storage";
import {findMaxDepthDirectory} from "../utils";
import {useStorageConverter} from "./useStorageConverter";

export function useStorageDataSync(
  directory: TypeDirectories,
  setDirectory: (dirs: TypeDirectories) => void
) {
  const {storageData} = useStorageData(directory);
  const {convertData} = useStorageConverter(directory);

  useEffect(() => {
    const data = storageData?.data ?? (storageData as unknown as TypeFile[]);
    const convertedData = convertData(data as TypeFile[]);
    if (!convertedData) return;
    let newDirectories = [...directory];
    const dirToChange = findMaxDepthDirectory(newDirectories) ?? newDirectories[0];
    if (dirToChange) {
      newDirectories = newDirectories.map(i =>
        i.fullPath === dirToChange.fullPath ? {...i, items: convertedData} : i
      );
    }
    console.log("Syncing storage data, new directories:", newDirectories);
    setDirectory(newDirectories);
  }, [storageData]);
}
