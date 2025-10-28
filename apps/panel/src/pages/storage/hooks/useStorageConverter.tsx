import type {DirectoryItem, TypeDirectories} from "../../../types/storage";
import type {Storage} from "../../../store/api/storageApi";
import {findMaxDepthDirectory} from "../utils";
import {ROOT_PATH} from "../constants";
import useStorageService from "../../../hooks/useStorage";
import {useCallback} from "react";

export function useStorageConverter(directory: TypeDirectories) {
  const {convertStorageToTypeFile} = useStorageService();

  const convertData = useCallback(
    (data: Storage[]): DirectoryItem[] | undefined => {
      if (!data || !Array.isArray(data)) return undefined;

      const dirToConvert = findMaxDepthDirectory(directory);
      if (!dirToConvert) return undefined;

      const parentPath =
        dirToConvert.fullPath === ROOT_PATH
          ? ""
          : dirToConvert.fullPath.split("/").filter(Boolean).join("/") + "/";

      return data.map(storage => {
        const typeFile = convertStorageToTypeFile(storage);
        const fullPath = typeFile.name;
        const isDirectory = typeFile.content?.type === "inode/directory";
      const nameParts = typeFile.name.split("/").filter(Boolean);
      const resolvedName = nameParts[nameParts.length - 1] + (isDirectory ? "/" : "");

        return {
          _id: typeFile._id,
          name: resolvedName,
          fullPath: fullPath,
          content: typeFile.content,
          url: typeFile.url,
          parentPath,
          isDirectory
        } as DirectoryItem;
      });
    },
    [directory, convertStorageToTypeFile]
  );

  return {convertData};
}