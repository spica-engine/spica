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
type TypeFileSizeUnit = "kb" | "mb" | "gb" | "tb";

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

function buildApiFilter(filterValue: TypeFilterValue): object {
  if (!filterValue) return {};

  const filter: any = {};

  // 1. Type filtering
  if (filterValue.type?.length) {
    // Match files with any of the selected extensions
    const typeRegexes = filterValue.type.map(ext => new RegExp(`\\.${ext}$`, "i").toString());
    filter["content.type"] = {$in: typeRegexes};
  }

  // 2. File size filtering
  if (filterValue.fileSize) {
    const sizeFilter: any = {};

    // Convert units to bytes
    const getByteSize = (value: number, unit: TypeFileSizeUnit) => {
      const multipliers: Record<TypeFileSizeUnit, number> = {
        kb: 1024,
        mb: 1024 ** 2,
        gb: 1024 ** 3,
        tb: 1024 ** 4
      };
      return value * multipliers[unit];
    };

    if (filterValue.fileSize.min?.value) {
      sizeFilter.$gte = getByteSize(
        filterValue.fileSize.min.value,
        filterValue.fileSize.min.unit as TypeFileSizeUnit
      );
    }

    if (filterValue.fileSize.max?.value) {
      sizeFilter.$lte = getByteSize(
        filterValue.fileSize.max.value,
        filterValue.fileSize.max.unit as TypeFileSizeUnit
      );
    }

    if (Object.keys(sizeFilter).length) {
      filter["content.size"] = sizeFilter;
    }
  }

  // 3. Date filtering
  if (filterValue.quickdate || filterValue.dateRange?.from || filterValue.dateRange?.to) {
    const dateFilter: any = {};

    // Handle quick date selections
    if (filterValue.quickdate) {
      const now = new Date();
      let fromDate;

      switch (filterValue.quickdate) {
        case "last_1_hour":
          fromDate = new Date(now.getTime() - 60 * 60 * 1000);
          break;
        case "last_24_hour":
          fromDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        // Add other cases as needed
        case "today":
          fromDate = new Date(now.setHours(0, 0, 0, 0));
          break;
      }

      if (fromDate) {
        dateFilter.$gte = fromDate.toISOString();
        dateFilter.$lte = now.toISOString();
      }
    } else {
      // Handle custom date range
      if (filterValue.dateRange?.from) {
        dateFilter.$gte = filterValue.dateRange.from;
      }
      if (filterValue.dateRange?.to) {
        dateFilter.$lte = filterValue.dateRange.to;
      }
    }

    if (Object.keys(dateFilter).length) {
      // Using _id to filter by date since ObjectIds contain creation timestamp
      filter["_id"] = dateFilter;
    }
  }

  return filter;
}

/**
 * Hook to fetch storage data based on directory filter
 */
function useStorageData(directory: TypeDirectories, apiFilter: object = {}) {
  const { buildDirectoryFilter } = useStorage();

  const filterArray = [
    "/",
    ...(findMaxDepthDirectory(directory)
      ?.fullPath.split("/")
      .filter(Boolean)
      .map(i => `${i}/`) || [])
  ];

  // Combine directory filter with API filter
  const directoryFilter = useMemo(() => buildDirectoryFilter(filterArray), [filterArray]);
  const combinedFilter = useMemo(() => {
    if (Object.keys(apiFilter).length === 0) return directoryFilter;
    
    // Merge directory filter with API filter using $and
    return { $and: [directoryFilter, apiFilter] };
  }, [directoryFilter, apiFilter]);
  
  const { data: storageData } = useGetStorageItemsQuery({ filter: combinedFilter });

  return { storageData };
}

/**
 * Hook to convert storage data to directory items
 */
function useStorageConverter(directory: TypeDirectories) {
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
  const [apiFilter, setApiFilter] = useState<object>({});

  const isFilteringOrSearching = !!(searchQuery || filterValue);

  const handleApplyFilter = (filter: TypeFilterValue) => {
    setFilterValue(filter);

    // Transform UI filter to API filter
    const newApiFilter = buildApiFilter(filter);
    setApiFilter(newApiFilter);
  };

  const filterItemsBySearch = (items: DirectoryItem[], query: string): DirectoryItem[] => {
    if (!query) return items;
    const lowerQuery = query.toLowerCase();
    return items.filter(item => item?.label?.toLowerCase().includes(lowerQuery));
  };

  // Apply client-side filtering for items already loaded
  const filterItemsByFilter = (
    items: DirectoryItem[],
    filter: TypeFilterValue
  ): DirectoryItem[] => {
    if (!filter) return items;

    return items.filter(item => {
      let matches = true;

      // 1. Type filtering
      if (filter.type?.length) {
        const extension = item.label?.split(".").pop()?.toLowerCase();
        matches = matches && extension ? filter.type.includes(extension) : false;
      }

      // 2. Size filtering
      if (matches && filter.fileSize && item.content?.size) {
        const getByteSize = (value: number, unit: TypeFileSizeUnit) => {
          const multipliers: Record<TypeFileSizeUnit, number> = {
            kb: 1024,
            mb: 1024 ** 2,
            gb: 1024 ** 3,
            tb: 1024 ** 4
          };
          return value * multipliers[unit];
        };

        if (filter.fileSize.min?.value) {
          const minBytes = getByteSize(
            filter.fileSize.min.value,
            filter.fileSize.min.unit as TypeFileSizeUnit
          );
          matches = matches && item.content.size >= minBytes;
        }

        if (filter.fileSize.max?.value) {
          const maxBytes = getByteSize(
            filter.fileSize.max.value,
            filter.fileSize.max.unit as TypeFileSizeUnit
          );
          matches = matches && item.content.size <= maxBytes;
        }
      }

      // 3. Date filtering - more complex, requires object ID parsing
      if (matches && (filter.quickdate || filter.dateRange)) {
        // Extract timestamp from ObjectId if available
        if (item._id) {
          const timestamp = parseInt(item._id.substring(0, 8), 16) * 1000;
          const itemDate = new Date(timestamp);

          if (filter.quickdate) {
            const now = new Date();
            let fromDate;

            switch (filter.quickdate) {
              case "last_1_hour":
                fromDate = new Date(now.getTime() - 60 * 60 * 1000);
                break;
              // Other cases...
            }

            if (fromDate) {
              matches = matches && itemDate >= fromDate && itemDate <= now;
            }
          } else if (filter.dateRange) {
            if (filter.dateRange.from) {
              matches = matches && itemDate >= new Date(filter.dateRange.from);
            }
            if (filter.dateRange.to) {
              matches = matches && itemDate <= new Date(filter.dateRange.to);
            }
          }
        }
      }

      return matches;
    });
  };

  return {
    searchQuery,
    setSearchQuery,
    filterValue,
    setFilterValue,
    apiFilter,
    isFilteringOrSearching,
    handleApplyFilter,
    filterItemsBySearch,
    filterItemsByFilter
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
 * Hook to handle filtered directory display
 */
export function useFilteredDirectory(
  directory: TypeDirectories,
  searchQuery: string,
  filterValue: TypeFilterValue | null,
  filterItemsBySearch: (items: DirectoryItem[], query: string) => DirectoryItem[],
  filterItemsByFilter: (items: DirectoryItem[], filter: TypeFilterValue) => DirectoryItem[],
  isFilteringOrSearching: boolean
) {

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

    // Apply filterValue logic for type, file size, and date filtering
    if (filterValue) {
      filteredItems = filterItemsByFilter(filteredItems, filterValue);
    }

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
  apiFilter: object = {},
  directory: TypeDirectories,
  setDirectory: (dirs: TypeDirectories) => void,
) {
  const {storageData} = useStorageData(directory, apiFilter);
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
) {
  const {convertData} = useStorageConverter(directory);

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
