import {useEffect, useMemo, useState} from "react";
import {useGetStorageItemsQuery} from "../../store/api";
import useStorage from "../../hooks/useStorage";
import type {TypeFile, TypeFilterValue} from "oziko-ui-kit";
import type {
  TypeDirectories,
  DirectoryItem,
  TypeDirectoryDepth
} from "../../components/organisms/storage-columns/StorageColumns";

const ROOT_PATH = "/";

/**
 * Utility function to get the parent path of a given path
 */
const getParentPath = (fullPath?: string) => {
  const res =
    fullPath?.replace(/\/[^/]+\/?$/, "") === fullPath
      ? "/"
      : fullPath?.replace(/\/[^/]+\/?$/, "") || "/";
  return res === "/" ? res : res + "/";
};

/**
 * Utility function to find the directory with the maximum depth
 */
function findMaxDepthDirectory<T extends {currentDepth?: number}>(arr: T[]): T | undefined {
  return arr.reduce<T | undefined>((max, obj) => {
    if (obj.currentDepth === undefined) return max;
    if (!max || max.currentDepth === undefined || obj.currentDepth > max.currentDepth) return obj;
    return max;
  }, undefined);
}

/**
 * Hook to manage directory state and navigation
 */
export function useDirectoryNavigation() {
  const [directory, setDirectory] = useState<TypeDirectories>([
    {
      items: undefined,
      label: "",
      fullPath: ROOT_PATH,
      currentDepth: 1,
      isActive: true,
      content: {type: "inode/directory", size: 0}
    }
  ]);

  const handleFolderClick = (
    folderName: string,
    fullPath: string,
    directoryDepth: TypeDirectoryDepth,
    wasActive: boolean,
    isFilteringOrSearching: boolean
  ) => {
    if (isFilteringOrSearching) return;

    if (wasActive) {
      const cleanDirectories = directory.map(dir => ({
        ...dir,
        isActive: false,
        currentDepth: undefined
      }));
      const dirToChange = findMaxDepthDirectory(directory);
      if (!dirToChange) return;
      const newDirectories = cleanDirectories.map(dir => {
        if (dir.fullPath === getParentPath(dirToChange?.fullPath!)) {
          return {...dir, isActive: true, currentDepth: dirToChange?.currentDepth};
        } else if (dir.fullPath === getParentPath(getParentPath(dirToChange?.fullPath!))) {
          const newDepth = (dirToChange?.currentDepth! - 1) as TypeDirectoryDepth;
          return {...dir, isActive: true, currentDepth: newDepth > 0 ? newDepth : undefined};
        }
        return dir;
      });
      setDirectory(newDirectories);
      return;
    }

    const depthToGive = Math.min(directoryDepth + 1, 3) as TypeDirectoryDepth;
    let theDirectory = directory.find(dir => dir.fullPath === fullPath);
    if (!theDirectory) {
      theDirectory = {
        items: undefined,
        label: folderName,
        fullPath: fullPath,
        currentDepth: depthToGive,
        isActive: true,
        content: {type: "inode/directory", size: 0}
      };
    } else {
      theDirectory = {...theDirectory, currentDepth: depthToGive, isActive: true};
    }
    const cleanDirectories = directory.map(dir => ({
      ...dir,
      isActive: false,
      currentDepth: undefined
    }));
    const newDirectories = cleanDirectories.map(dir => {
      if (getParentPath(theDirectory.fullPath) === dir.fullPath) {
        const newDepth = ((theDirectory.currentDepth as TypeDirectoryDepth) -
          1) as TypeDirectoryDepth;
        return {...dir, isActive: newDepth > 0, currentDepth: newDepth > 0 ? newDepth : undefined};
      } else if (getParentPath(getParentPath(theDirectory.fullPath)) === dir.fullPath) {
        const newDepth = ((theDirectory.currentDepth as TypeDirectoryDepth) -
          2) as TypeDirectoryDepth;
        return {...dir, isActive: newDepth > 0, currentDepth: newDepth > 0 ? newDepth : undefined};
      } else if (dir.fullPath === theDirectory.fullPath) {
        return theDirectory;
      }
      return dir;
    });
    if (!newDirectories.find(dir => dir.fullPath === theDirectory.fullPath)) {
      newDirectories.push(theDirectory);
    }
    setDirectory(newDirectories);
  };

  return {
    directory,
    setDirectory,
    handleFolderClick
  };
}

/**
 * Hook to manage search and filter state
 */
export function useSearchAndFilter() {
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [filterValue, setFilterValue] = useState<TypeFilterValue | null>(null);

  const isFilteringOrSearching = !!(searchQuery || filterValue);

  const handleApplyFilter = (filter: TypeFilterValue) => {
    setFilterValue(filter);
  };

  const filterItemsBySearch = (items: DirectoryItem[], query: string): DirectoryItem[] => {
    if (!query) return items;
    const lowerQuery = query.toLowerCase();
    return items.filter(item => item?.label?.toLowerCase().includes(lowerQuery));
  };

  return {
    searchQuery,
    setSearchQuery,
    filterValue,
    setFilterValue,
    isFilteringOrSearching,
    handleApplyFilter,
    filterItemsBySearch
  };
}

/**
 * Hook to manage file preview state
 */
export function useFilePreview() {
  const [previewFile, setPreviewFile] = useState<DirectoryItem>();

  const handleClosePreview = () => setPreviewFile(undefined);

  return {
    previewFile,
    setPreviewFile,
    handleClosePreview
  };
}

/**
 * Hook to fetch storage data based on directory filter
 */
export function useStorageData(directory: TypeDirectories) {
  const {buildDirectoryFilter} = useStorage();

  const filterArray = [
    "/",
    ...(findMaxDepthDirectory(directory)
      ?.fullPath.split("/")
      .filter(Boolean)
      .map(i => `${i}/`) || [])
  ];

  const filter = useMemo(() => buildDirectoryFilter(filterArray), [filterArray]);
  const {data: storageData} = useGetStorageItemsQuery({filter});

  return {storageData};
}

/**
 * Hook to convert storage data to directory items
 */
export function useStorageConverter(directory: TypeDirectories) {
  const {convertStorageToTypeFile} = useStorage();

  const convertData = (data: TypeFile[]) => {
    const convertedData = data?.map(storage => {
      const typeFile = convertStorageToTypeFile(storage);
      const nameParts = typeFile.name.split("/").filter(Boolean);
      const isFolder = typeFile.content.type === "inode/directory";
      const resolvedName = nameParts[nameParts.length - 1] + (isFolder ? "/" : "");

      return {
        ...typeFile,
        items: undefined,
        label: resolvedName,
        fullPath: storage.name,
        currentDepth: Math.min(directory.filter(dir => dir.currentDepth).length, 3),
        isActive: false
      };
    });
    return convertedData;
  };

  return {convertData};
}

/**
 * Hook to handle filtered directory display
 */
export function useFilteredDirectory(
  directory: TypeDirectories,
  searchQuery: string,
  filterValue: TypeFilterValue | null,
  filterItemsBySearch: (items: DirectoryItem[], query: string) => DirectoryItem[]
) {
  const isFilteringOrSearching = searchQuery || filterValue;

  const getFilteredDirectory = (): TypeDirectories => {
    if (!isFilteringOrSearching) return directory;

    const allItems = directory.reduce<DirectoryItem[]>((acc, dir) => {
      if (dir.items) {
        return [...acc, ...dir.items];
      }
      return acc;
    }, []);

    let filteredItems = allItems.filter(item => item.content.type !== "inode/directory");

    if (searchQuery) {
      filteredItems = filterItemsBySearch(filteredItems, searchQuery);
    }

    // TODO: Apply filterValue logic here when filter functionality is implemented
    // This would include type, file size, and date filtering

    return [
      {
        items: filteredItems,
        label: "Search Results",
        fullPath: ROOT_PATH,
        currentDepth: 1,
        isActive: true,
        content: {type: "inode/directory", size: 0}
      }
    ];
  };

  return {
    displayedDirectory: getFilteredDirectory(),
    isFilteringOrSearching
  };
}

/**
 * Hook to sync storage data with directory state
 */
export function useStorageDataSync(
  storageData: any,
  directory: TypeDirectories,
  setDirectory: (dirs: TypeDirectories) => void,
  convertData: (data: TypeFile[]) => any[]
) {
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
    setDirectory(newDirectories);
  }, [storageData]);
}

/**
 * Hook to handle file operations (upload, replace, delete)
 */
export function useFileOperations(
  directory: TypeDirectories,
  setDirectory: (dirs: TypeDirectories) => void,
  setPreviewFile: (file: DirectoryItem | undefined) => void,
  convertData: (data: TypeFile[]) => any[]
) {
  const onUploadComplete = (file: TypeFile & {prefix?: string}) => {
    const newDirectories = directory.map(dir => {
      const {prefix, ...fileWithoutPrefix} = file;
      const convertedFile = convertData([fileWithoutPrefix])[0];
      if (dir.fullPath === prefix || (!prefix && dir.fullPath === ROOT_PATH)) {
        return {
          ...dir,
          items: dir.items ? [...dir.items, convertedFile] : [convertedFile]
        };
      }
      return dir;
    });
    setDirectory(newDirectories);
  };

  const onFileReplaced = (updatedFile: TypeFile) => {
    const newDirectories = directory.map(dir => {
      if (dir.items) {
        const updatedItems = dir.items.map(item =>
          item._id === updatedFile._id ? updatedFile : item
        );
        return {
          ...dir,
          items: updatedItems
        };
      }
      return dir;
    });
    setDirectory(newDirectories as TypeDirectories);
    setPreviewFile(updatedFile as DirectoryItem);
  };

  const onFileDeleted = (fileId: string) => {
    const newDirectories = directory.map(dir => {
      if (dir.items) {
        const filteredItems = dir.items.filter(item => item._id !== fileId);
        return {
          ...dir,
          items: filteredItems
        };
      }
      return dir;
    });
    setDirectory(newDirectories as TypeDirectories);
    setPreviewFile(undefined);
  };

  return {
    onUploadComplete,
    onFileReplaced,
    onFileDeleted
  };
}
