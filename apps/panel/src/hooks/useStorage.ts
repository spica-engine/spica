import { useCallback, useState } from "react";
import {
  useUploadFilesMutation,
  useUpdateStorageItemMutation,
  useDeleteStorageItemMutation,
  useUpdateStorageNameMutation,
  type Storage,
} from "../store/api";

function useStorageService() {
  const [uploadProgress, setUploadProgress] = useState(0);
  
  // RTK Query hooks for mutations only
  const [uploadFiles, uploadResult] = useUploadFilesMutation();
  const [updateStorageItem] = useUpdateStorageItemMutation();
  const [deleteStorageItem] = useDeleteStorageItemMutation();
  const [updateStorageName] = useUpdateStorageNameMutation();

  // Enhanced upload with progress tracking
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

  return {
    // Mutation functions
    uploadFiles: uploadFilesWithProgress,
    updateOne,
    deleteOne,
    updateName,
    
    // Loading states
    uploadLoading: uploadResult.isLoading,
    uploadProgress,
    
    // Error states
    uploadError: uploadResult.error,
  };
}

export default useStorageService;