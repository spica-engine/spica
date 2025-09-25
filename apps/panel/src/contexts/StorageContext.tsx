import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode
} from "react";
import useApi from "../hooks/useApi";

export interface Storage {
  _id?: string;
  name: string;
  url?: string;
  content?: {
    type: string;
    size?: number;
  };
}

export interface StorageNode extends Storage {
  index?: number;
  parent: StorageNode | undefined;
  children: StorageNode[];
  isDirectory: boolean;
  isHighlighted: boolean;
}

export interface StorageListResponse {
  data: Storage[];
  meta: {
    total: number;
  };
}

interface StorageOptions {
  filter?: object;
  limit?: number;
  skip?: number;
  sort?: object;
  paginate?: boolean;
}

interface IStorageContext {
  storageItems: Storage[];
  loading: boolean;
  uploadProgress: number;
  getAll: (options?: StorageOptions) => Promise<StorageListResponse>;
  getOne: (id: string) => Promise<Storage>;
  uploadFiles: (files: FileList, prefix?: string) => Promise<Storage>;
  updateOne: (storageObject: Storage, file: File) => Promise<Storage>;
  deleteOne: (id: string) => Promise<void>;
  updateName: (id: string, name: string) => Promise<Storage>;
  listSubResources: (name: string, itself: boolean) => Promise<Storage[]>;
  refreshStorage: () => Promise<void>;
}

const StorageContext = createContext<IStorageContext | null>(null);

export const StorageProvider = ({children}: {children: ReactNode}) => {
  const [storageItems, setStorageItems] = useState<Storage[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);

  const {request: getAllRequest, loading: getAllLoading} = useApi<StorageListResponse>({
    endpoint: "/api/storage"
  });

  const {request: getOneRequest} = useApi<Storage>({
    endpoint: ""
  });

  const {request: uploadRequest, loading: uploadLoading} = useApi<Storage>({
    endpoint: "/api/storage",
    method: "post"
  });

  const {request: updateRequest, loading: updateLoading} = useApi<Storage>({
    endpoint: "",
    method: "put"
  });

  const {request: deleteRequest} = useApi<void>({
    endpoint: "",
    method: "delete"
  });

  const {request: updateNameRequest} = useApi<Storage>({
    endpoint: "",
    method: "patch"
  });

  const loading = getAllLoading || uploadLoading || updateLoading;

  const getAll = useCallback(
    async (options: StorageOptions = {}): Promise<StorageListResponse> => {
      try {
        const params = new URLSearchParams();

        if (options.limit) params.append("limit", options.limit.toString());
        if (options.skip) params.append("skip", options.skip.toString());
        if (options.sort) params.append("sort", JSON.stringify(options.sort));
        if (options.filter) params.append("filter", JSON.stringify(options.filter));
        params.append("paginate", JSON.stringify(options.paginate || false));

        const response = await getAllRequest({
          endpoint: `/api/storage?${params.toString()}`
        });

        const items = Array.isArray(response) ? response : response.data;
        setStorageItems(items);
        
        return Array.isArray(response) 
          ? { data: response, meta: { total: response.length } }
          : response;
      } catch (error) {
        console.error("Failed to fetch storage items:", error);
        throw error;
      }
    },
    [getAllRequest]
  );

  const refreshStorage = useCallback(async () => {
    try {
      await getAll();
    } catch (error) {
      console.error("Failed to refresh storage:", error);
    }
  }, [getAll]);

  const getOne = useCallback(
    async (id: string): Promise<Storage> => {
      try {
        const response = await getOneRequest({
          endpoint: `/api/storage/${id}`
        });
        return response;
      } catch (error) {
        console.error(`Failed to fetch storage item ${id}:`, error);
        throw error;
      }
    },
    [getOneRequest]
  );

  const uploadFiles = useCallback(
    async (files: FileList, prefix?: string): Promise<Storage> => {
      setUploadProgress(0);
      
      try {
        const formData = new FormData();
        
        Array.from(files).forEach(file => {
          const fileName = prefix ? `${prefix}${file.name}` : file.name;
          const encodedName = encodeURIComponent(fileName);
          const renamedFile = new File([file], encodedName, {
            type: file.type,
            lastModified: file.lastModified
          });
          formData.append("files", renamedFile);
        });

        const response = await uploadRequest({
          body: formData
        });

        await refreshStorage();
        return response;
      } catch (error) {
        console.error("Failed to upload files:", error);
        throw error;
      } finally {
        setUploadProgress(0);
      }
    },
    [uploadRequest, refreshStorage]
  );

  const updateOne = useCallback(
    async (storageObject: Storage, file: File): Promise<Storage> => {
      setUploadProgress(0);

      try {
        const formData = new FormData();
        const encodedName = encodeURIComponent(storageObject.name);
        const renamedFile = new File([file], encodedName, {
          type: file.type,
          lastModified: file.lastModified
        });
        formData.append("file", renamedFile);

        const response = await updateRequest({
          endpoint: `/api/storage/${storageObject._id}`,
          body: formData
        });

        await refreshStorage();
        return response;
      } catch (error) {
        console.error(`Failed to update storage item ${storageObject._id}:`, error);
        throw error;
      } finally {
        setUploadProgress(0);
      }
    },
    [updateRequest, refreshStorage]
  );

  const deleteOne = useCallback(
    async (id: string): Promise<void> => {
      try {
        await deleteRequest({
          endpoint: `/api/storage/${id}`
        });
        
        setStorageItems(prev => prev.filter(item => item._id !== id));
      } catch (error) {
        console.error(`Failed to delete storage item ${id}:`, error);
        throw error;
      }
    },
    [deleteRequest]
  );

  const updateName = useCallback(
    async (id: string, name: string): Promise<Storage> => {
      try {
        const response = await updateNameRequest({
          endpoint: `/api/storage/${id}`,
          body: JSON.stringify({ name }),
          headers: {
            "Content-Type": "application/json"
          } as any
        });

        setStorageItems(prev =>
          prev.map(item => (item._id === id ? { ...item, name } : item))
        );

        return response;
      } catch (error) {
        console.error(`Failed to update storage item name ${id}:`, error);
        throw error;
      }
    },
    [updateNameRequest]
  );

  const listSubResources = useCallback(
    async (name: string, itself: boolean): Promise<Storage[]> => {
      try {
        const filter = {
          name: itself 
            ? { $regex: `^${name}` }
            : { $regex: `^${name}/` }
        };
        
        const response = await getAll({ filter });
        return response.data;
      } catch (error) {
        console.error(`Failed to list sub-resources for ${name}:`, error);
        throw error;
      }
    },
    [getAll]
  );

  const contextValue = useMemo(
    () => ({
      storageItems,
      loading,
      uploadProgress,
      getAll,
      getOne,
      uploadFiles,
      updateOne,
      deleteOne,
      updateName,
      listSubResources,
      refreshStorage
    }),
    [
      storageItems,
      loading,
      uploadProgress,
      getAll,
      getOne,
      uploadFiles,
      updateOne,
      deleteOne,
      updateName,
      listSubResources,
      refreshStorage
    ]
  );

  return <StorageContext value={contextValue}>{children}</StorageContext>;
};

export function useStorage() {
  const context = useContext(StorageContext);
  if (!context) {
    throw new Error("useStorage must be used within a StorageProvider");
  }
  return context;
}

export default StorageContext;