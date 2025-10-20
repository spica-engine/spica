import {useEffect, useMemo, useState} from "react";
import {useGetStorageItemsQuery} from "../../store/api";
import useStorage from "../../hooks/useStorage";
import type {TypeFile, TypeFilterValue} from "oziko-ui-kit";
import type {
  TypeDirectories,
  DirectoryItem,
  TypeDirectoryDepth
} from "../../components/organisms/storage-columns/StorageColumns";
import {convertQuickDateToRange} from "../../utils/storage";

export const ROOT_PATH = "/";

const INITIAL_DIRECTORIES: TypeDirectories = [
  {
    items: undefined,
    label: "",
    fullPath: ROOT_PATH,
    currentDepth: 1,
    isActive: true,
    content: {type: "inode/directory", size: 0}
  }
];

type TypeFileSizeUnit = "kb" | "mb" | "gb" | "tb";

const getParentPath = (fullPath?: string) => {
  const res =
    fullPath?.replace(/\/[^/]+\/?$/, "") === fullPath
      ? "/"
      : fullPath?.replace(/\/[^/]+\/?$/, "") || "/";
  return res === "/" ? res : res + "/";
};

export function findMaxDepthDirectory<T extends {currentDepth?: number}>(arr: T[]): T | undefined {
  return arr.reduce<T | undefined>((max, obj) => {
    if (obj.currentDepth === undefined) return max;
    if (!max || max.currentDepth === undefined || obj.currentDepth > max.currentDepth) return obj;
    return max;
  }, undefined);
}

function buildApiFilter(filterValue: TypeFilterValue): object {
  if (!filterValue) return {};

  const filter: {
    "content.type"?: {$in: string[]};
    "content.size"?: {$gte?: number; $lte?: number};
    created_at?: {$gte?: string; $lte?: string};
    name?: {$regex: string; $options: string};
  } = {};

  if (filterValue.type?.length) {
    filter["content.type"] = {$in: filterValue.type};
  }

  if (filterValue.fileSize) {
    const sizeFilter: {$gte?: number; $lte?: number} = {};

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

  if (filterValue.quickdate || filterValue.dateRange?.from || filterValue.dateRange?.to) {
    const dateFilter: {$gte?: string; $lte?: string} = {};

    if (filterValue.quickdate) {
      const quickdateValue = filterValue.quickdate as string;
      const range = convertQuickDateToRange(quickdateValue);
      const quickdateFilter = range
        ? {
            $gte: range.from?.toISOString(),
            $lte: range.to?.toISOString()
          }
        : null;
      if (quickdateFilter) {
        Object.assign(dateFilter, quickdateFilter);
      }
    } else {
      if (filterValue.dateRange?.from) {
        const fromDate =
          typeof filterValue.dateRange.from === "string"
            ? new Date(filterValue.dateRange.from)
            : filterValue.dateRange.from;
        dateFilter.$gte = fromDate.toISOString();
      }
      if (filterValue.dateRange?.to) {
        const toDate =
          typeof filterValue.dateRange.to === "string"
            ? new Date(filterValue.dateRange.to)
            : filterValue.dateRange.to;
        dateFilter.$lte = toDate.toISOString();
      }
    }

    if (Object.keys(dateFilter).length) {
      filter["created_at"] = dateFilter;
    }
  }

  return filter;
}

function useStorageData(
  directory: TypeDirectories,
  apiFilter: object = {},
  searchQuery: string = "",
  isFilteringOrSearching: boolean = false
) {
  const {buildDirectoryFilter} = useStorage();

  const filterArray = [
    "/",
    ...(findMaxDepthDirectory(directory)
      ?.fullPath.split("/")
      .filter(Boolean)
      .map(i => `${i}/`) || [])
  ];

  const directoryFilter = useMemo(() => {
    if (isFilteringOrSearching) return {};
    return buildDirectoryFilter(filterArray);
  }, [filterArray, isFilteringOrSearching]);

  const searchFilter = useMemo(() => {
    if (!searchQuery) return {};

    return {
      name: {
        $regex: searchQuery,
        $options: "i"
      }
    };
  }, [searchQuery]);

  const combinedFilter = useMemo(() => {
    const filters: object[] = [];

    if (Object.keys(directoryFilter).length > 0) {
      filters.push(directoryFilter);
    }

    if (Object.keys(apiFilter).length > 0) {
      filters.push(apiFilter);
    }

    if (Object.keys(searchFilter).length > 0) {
      filters.push(searchFilter);
    }

    if (filters.length === 1) {
      return filters[0];
    }

    return {$and: filters};
  }, [directoryFilter, apiFilter, searchFilter]);

  const {
    data: storageData,
    isFetching,
    isLoading
  } = useGetStorageItemsQuery({filter: combinedFilter});

  return {storageData, isLoading: isFetching || isLoading};
}

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

export function useDirectoryNavigation() {
  const [directory, setDirectory] = useState<TypeDirectories>(INITIAL_DIRECTORIES);

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

export function useSearchAndFilter() {
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [filterValue, setFilterValue] = useState<TypeFilterValue | null>(null);
  const [apiFilter, setApiFilter] = useState<object>({});

  const isFilteringOrSearching = !!(searchQuery || filterValue);

  const handleApplyFilter = (filter: TypeFilterValue) => {
    setFilterValue(filter);

    const newApiFilter = buildApiFilter(filter);
    setApiFilter(newApiFilter);
  };

  return {
    searchQuery,
    setSearchQuery,
    filterValue,
    setFilterValue,
    apiFilter,
    isFilteringOrSearching,
    handleApplyFilter
  };
}

export function useFilePreview() {
  const [previewFile, setPreviewFile] = useState<DirectoryItem>();

  const handleClosePreview = () => setPreviewFile(undefined);

  return {
    previewFile,
    setPreviewFile,
    handleClosePreview
  };
}

export function useFilteredDirectory(directory: TypeDirectories, isFilteringOrSearching: boolean) {
  const getFilteredDirectory = (): TypeDirectories => {
    if (!isFilteringOrSearching) return directory;

    const allItems = directory.reduce<DirectoryItem[]>((acc, dir) => {
      if (dir.items) {
        return [...acc, ...dir.items];
      }
      return acc;
    }, []);

    const seen = new Set();
    const filteredItems = allItems.filter(item => {
      if (item.content.type === "inode/directory") return false;
      if (seen.has(item._id)) return false;
      seen.add(item._id);
      return true;
    });

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

export function useStorageDataSync(
  apiFilter: object = {},
  directory: TypeDirectories,
  setDirectory: (dirs: TypeDirectories) => void,
  searchQuery: string = "",
  isFilteringOrSearching: boolean = false
) {
  const {storageData, isLoading} = useStorageData(
    directory,
    apiFilter,
    searchQuery,
    isFilteringOrSearching
  );
  const {convertData} = useStorageConverter(directory);

  useEffect(() => {
    const data = storageData?.data ?? (storageData as unknown as TypeFile[]);
    const convertedData = convertData(data as TypeFile[]);
    if (!convertedData) return;
    if (convertedData.length == 0 && isFilteringOrSearching) {
      setDirectory(INITIAL_DIRECTORIES);
      return;
    }
    let newDirectories = [...directory];
    const dirToChange = findMaxDepthDirectory(newDirectories) ?? newDirectories[0];
    if (dirToChange) {
      newDirectories = newDirectories.map(i =>
        i.fullPath === dirToChange.fullPath ? {...i, items: convertedData} : i
      );
    }
    setDirectory(newDirectories);
  }, [storageData]);

  return {isLoading};
}

export function useFileOperations(
  directory: TypeDirectories,
  setDirectory: (dirs: TypeDirectories) => void,
  setPreviewFile: (file: DirectoryItem | undefined) => void
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
