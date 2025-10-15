import { useCallback, useState } from "react";
import {
  useUploadFilesMutation,
  useUpdateStorageItemMutation,
  useDeleteStorageItemMutation,
  useUpdateStorageNameMutation,
  type Storage,
} from "../store/api";
import type { TypeFile } from "oziko-ui-kit";

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
          setUploadProgress((prev) => {
            if (prev >= 90) {
              clearInterval(progressInterval);
              return prev;
            }
            return prev + 10;
          });
        }, 100);

        const result = await uploadFiles({ files, prefix }).unwrap();
        
        clearInterval(progressInterval);
        setUploadProgress(100);
        
        setTimeout(() => setUploadProgress(0), 1000);
        
        return result;
      } catch (error) {
        setUploadProgress(0);
        console.error('Upload failed:', error);
        throw error;
      }
    },
    [uploadFiles]
  );

  const updateOne = useCallback(
    async (id: string, file: File) => {
      try {
        return await updateStorageItem({ id, file }).unwrap();
      } catch (error) {
        console.error('Update failed:', error);
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
        console.error('Delete failed:', error);
        throw error;
      }
    },
    [deleteStorageItem]
  );

  const updateName = useCallback(
    async (id: string, name: string) => {
      try {
        return await updateStorageName({ id, name }).unwrap();
      } catch (error) {
        console.error('Name update failed:', error);
        throw error;
      }
    },
    [updateStorageName]
  );


  const convertStorageToTypeFile = (storage: Storage): TypeFile => ({
    _id: storage._id || "",
    name: storage.name,
    content: {
      type: storage.name.endsWith("/")
        ? "inode/directory"
        : storage.content?.type || "application/octet-stream",
      size: storage.content?.size || 0
    },
    url: storage.url || ""
  });

  const buildDirectoryFilter = useCallback((directory: string[]) => {
    const currentDirectory = directory.length === 1 ? "/" : directory.slice(1).join("");

    if (currentDirectory === "/") {
      return {
        $or: [
          {name: {$regex: "^[^/]+$"}},
          {name: {$regex: "^[^/]+/$"}}
        ]
      };
    } else {
      const escapedDirectory = currentDirectory.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return {
        $and: [
          {name: {$regex: `^${escapedDirectory}`}},
          {
            $or: [
              {name: {$regex: `^${escapedDirectory}[^/]+$`}},
              {name: {$regex: `^${escapedDirectory}[^/]+/$`}}
            ]
          }
        ]
      };
    }
  }, []);

  return {
    uploadFiles: uploadFilesWithProgress,
    updateOne,
    deleteOne,
    updateName,
    
    uploadLoading: uploadResult.isLoading,
    uploadProgress,
    
    uploadError: uploadResult.error,

    convertStorageToTypeFile,
    buildDirectoryFilter
  };
}

export default useStorageService;