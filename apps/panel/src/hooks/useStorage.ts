import {useCallback, useState} from "react";
import {
  useUploadFilesMutation,
  useUpdateStorageItemMutation,
  useDeleteStorageItemMutation,
  useUpdateStorageNameMutation,
  type Storage
} from "../store/api";
import type {TypeFile} from "oziko-ui-kit";
import {kitFileKey} from "../types/storage";
import {idOf} from "../utils/recordKey";
import {allOf, anyOf, escapeRegex, matchesName, type StorageClause} from "../utils/storageQuery";

function useStorageService() {
  const [uploadProgress, setUploadProgress] = useState(0);

  const [uploadFiles, uploadResult] = useUploadFilesMutation();
  const [updateStorageItem] = useUpdateStorageItemMutation();
  const [deleteStorageItem] = useDeleteStorageItemMutation();
  const [updateStorageName] = useUpdateStorageNameMutation();

  const uploadFilesWithProgress = useCallback(
    async (files: FileList, prefix?: string) => {
      try {
        setUploadProgress(0);

        const progressInterval = setInterval(() => {
          setUploadProgress(prev => {
            if (prev >= 90) {
              clearInterval(progressInterval);
              return prev;
            }
            return prev + 10;
          });
        }, 100);

        const result = await uploadFiles({files, prefix}).unwrap();

        clearInterval(progressInterval);
        setUploadProgress(100);

        setTimeout(() => setUploadProgress(0), 1000);

        return result;
      } catch (error) {
        setUploadProgress(0);
        console.error("Upload failed:", error);
        throw error;
      }
    },
    [uploadFiles]
  );

  const updateOne = useCallback(
    async (id: string, file: File) => {
      try {
        return await updateStorageItem({id, file}).unwrap();
      } catch (error) {
        console.error("Update failed:", error);
        throw error;
      }
    },
    [updateStorageItem]
  );

  const deleteOne = useCallback(
    async (id: string) => {
      try {
        await deleteStorageItem(id).unwrap();
      } catch (error) {
        console.error("Delete failed:", error);
        throw error;
      }
    },
    [deleteStorageItem]
  );

  const updateName = useCallback(
    async (id: string, name: string) => {
      try {
        return await updateStorageName({id, name}).unwrap();
      } catch (error) {
        console.error("Name update failed:", error);
        throw error;
      }
    },
    [updateStorageName]
  );

  const buildDirectoryClause = useCallback((directory: string[] = ["/"]): StorageClause => {
    const currentDirectory = directory.length === 1 ? "/" : directory.slice(1).join("");

    if (currentDirectory === "/") {
      return anyOf([matchesName("^[^/]+$"), matchesName("^[^/]+/$")]);
    }

    const escapedDirectory = escapeRegex(currentDirectory);
    return allOf([
      matchesName(`^${escapedDirectory}`),
      anyOf([
        matchesName(`^${escapedDirectory}[^/]+$`),
        matchesName(`^${escapedDirectory}[^/]+/$`)
      ])
    ])!;
  }, []);

  const convertStorageToTypeFile = useCallback(
    (storage: Storage): TypeFile => {
      const apiBase = (import.meta.env.VITE_BASE_URL as string) || "/api";
      const base = apiBase.endsWith("/") ? apiBase.slice(0, -1) : apiBase;
      const viewUrl = idOf(storage)!
        ? `${base}/storage/${idOf(storage)!}/view`
        : storage.url || "";

      return {
        ...kitFileKey(idOf(storage)),
        name: storage.name,
        content: {
          type: storage.name.endsWith("/")
            ? "inode/directory"
            : storage.content?.type || "application/octet-stream",
          size: storage.content?.size || 0
        },
        url: viewUrl
      };
    },
    []
  );

  return {
    uploadFiles: uploadFilesWithProgress,
    updateOne,
    deleteOne,
    updateName,
    buildDirectoryClause,
    convertStorageToTypeFile,

    uploadLoading: uploadResult.isLoading,
    uploadProgress,

    uploadError: uploadResult.error
  };
}

export default useStorageService;
