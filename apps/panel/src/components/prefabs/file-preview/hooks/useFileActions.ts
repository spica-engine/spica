/**
 * @owner Kanan Gasimov
 * email: rio.kenan@gmail.com
 */

import {useCallback, useRef} from "react";
import type {DirectoryItem} from "src/types/storage";
import {generatePublicFileUrl} from "../utils";
import {getParentPath} from "../../../../pages/storage/utils";
import {ROOT_PATH} from "../../../../pages/storage/constants";

interface FileOperationsConfig {
  serverUrl: string;
  origin: string;
}

interface ReplaceFileParams {
  fileId: string;
  parentPath: string;
  newFile: File;
}


interface UpdateStorageItemResult<T = any> {
  unwrap: () => Promise<T>;
}

interface FileActionsCallbacks {
  onFileReplaced?: (file: DirectoryItem) => void;
  updateStorageItem: (params: {id: string; file: File}) => UpdateStorageItemResult;
}

interface UseFileActionsReturn {
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  handleCopyUrl: (file: DirectoryItem) => Promise<void>;
  handleReplaceFile: (event: React.ChangeEvent<HTMLInputElement>, originalFile: DirectoryItem) => void;
}

function createTemporaryFileItem(
  originalFile: DirectoryItem,
  newFile: File,
  fullPath: string
): DirectoryItem {
  return {
    ...originalFile,
    name: fullPath,
    label: newFile.name,
    content: {
      type: newFile.type,
      size: newFile.size
    }
  };
}

function createUpdatedFileItem(
  updatedFile: any,
  fileName: string,
  originalDepth: number | undefined
): DirectoryItem {
  return {
    ...updatedFile,
    label: fileName,
    fullPath: updatedFile.name || fileName,
    currentDepth: originalDepth
  } as DirectoryItem;
}

function prepareFileForUpload(file: File, parentPath: string): {uploadFile: File; fullPath: string} {
  const fileName = file.name;
  const fullPath = parentPath === ROOT_PATH ? fileName : `${parentPath}${fileName}`;
  const encodedFileName = encodeURIComponent(fullPath);
  const uploadFile = new File([file], encodedFileName, {type: file.type});

  return {uploadFile, fullPath};
}

export function useFileActions(
  config: FileOperationsConfig,
  callbacks: FileActionsCallbacks
): UseFileActionsReturn {
  const {serverUrl, origin} = config;
  const {onFileReplaced, updateStorageItem} = callbacks;
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleCopyUrl = useCallback(
    async (file: DirectoryItem) => {
      if (!file._id || !file.url) return;

      const publicUrl = generatePublicFileUrl(file._id, file.url, {serverUrl, origin});

      try {
        await navigator.clipboard.writeText(publicUrl);
      } catch (error) {
        console.error("Failed to copy URL to clipboard:", error);
      }
    },
    [serverUrl, origin]
  );

  const handleReplaceFile = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>, originalFile: DirectoryItem) => {
      const files = event.target.files;
      if (!files || files.length === 0) return;
      if (!originalFile?._id) return;

      const newFile = files[0];
      const parentPath = getParentPath(originalFile.fullPath);
      const {uploadFile, fullPath} = prepareFileForUpload(newFile, parentPath);

      const temporaryFile = createTemporaryFileItem(originalFile, newFile, fullPath);
      onFileReplaced?.(temporaryFile);

      updateStorageItem({id: originalFile._id, file: uploadFile})
        .unwrap()
        .then((updatedFile: any) => {
          if (!updatedFile) {
            // Revert to original file if update failed
            onFileReplaced?.(originalFile);
            return;
          }

          const finalFile = createUpdatedFileItem(
            updatedFile,
            newFile.name,
            originalFile.currentDepth
          );
          onFileReplaced?.(finalFile);
        })
        .catch((error: unknown) => {
          console.error("File replacement failed:", error);
          onFileReplaced?.(originalFile);
        });

      event.target.value = "";
    },
    [onFileReplaced, updateStorageItem]
  );

  return {
    fileInputRef,
    handleCopyUrl,
    handleReplaceFile
  };
}

