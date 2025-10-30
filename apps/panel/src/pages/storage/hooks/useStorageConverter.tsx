import type {DirectoryItem, TypeDirectories, TypeDirectoryDepth} from "../../../types/storage";
import type {Storage} from "../../../store/api/storageApi";
import {findMaxDepthDirectory} from "../utils";
import useStorageService from "../../../hooks/useStorage";
import {useCallback} from "react";

export function useStorageConverter(directory: TypeDirectories) {
  const {convertStorageToTypeFile} = useStorageService();

  const convertData = useCallback(
    (data: Storage[], depth?: TypeDirectoryDepth): DirectoryItem[] | undefined => {
      if (!data || !Array.isArray(data)) return undefined;

      const dirToConvert = findMaxDepthDirectory(directory);
      if (!dirToConvert) return undefined;

      return data.map(storage => {
        const typeFile = convertStorageToTypeFile(storage);
        const isDirectory = typeFile.content?.type === "inode/directory";
        const nameParts = typeFile.name.split("/").filter(Boolean);
        const resolvedName = nameParts[nameParts.length - 1] + (isDirectory ? "/" : "");

        return {
          ...typeFile,
          items: undefined,
          label: resolvedName,
          fullPath: storage.name,
          currentDepth: depth ?? directory.filter(dir => dir.currentDepth).length,
          isActive: false,
        } as DirectoryItem;
      });
    },
    [directory, convertStorageToTypeFile]
  );

  return {convertData};
}
