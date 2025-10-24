import {useEffect, useMemo, useState} from "react";
import useStorage from "../../hooks/useStorage";
import type {TypeFile} from "oziko-ui-kit";
import type {
  TypeDirectories,
  DirectoryItem,
  TypeDirectoryDepth
} from "./components/StorageColumns";
import {useGetStorageItemsQuery} from "../../store/api";

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
        currentDepth: directory.filter(dir => dir.currentDepth).length,
        isActive: false
      };
    });
    return convertedData;
  };

  return {convertData};
}

function useStorageData(directory: TypeDirectories) {
  const {buildDirectoryFilter} = useStorage();

  const filterArray = [
    "/",
    ...(findMaxDepthDirectory(directory)
      ?.fullPath.split("/")
      .filter(Boolean)
      .map(i => `${i}/`) || [])
  ];

  const directoryFilter = useMemo(() => buildDirectoryFilter(filterArray), [filterArray]);

  const {data: storageData} = useGetStorageItemsQuery({filter: directoryFilter});

  return {storageData};
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
      const newDirectories = directory.map(dir => {
        if (dir.currentDepth !== undefined && dir.currentDepth <= directoryDepth) {
          return {
            ...dir,
            isActive: true
          };
        }

        return {
          ...dir,
          isActive: false,
          currentDepth: undefined
        };
      });
      setDirectory(newDirectories);
      return;
    }

    const depthToGive = directoryDepth + 1;
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
    const ancestorPaths = new Set<string>();
    let currentPath = fullPath;
    while (currentPath !== ROOT_PATH) {
      ancestorPaths.add(currentPath);
      currentPath = getParentPath(currentPath);
    }
    ancestorPaths.add(ROOT_PATH);

    const newDirectories = directory.map(dir => {
      if (dir.fullPath === fullPath) {
        return theDirectory;
      }

      if (ancestorPaths.has(dir.fullPath)) {
        const pathDepth =
          dir.fullPath === ROOT_PATH ? 1 : dir.fullPath.split("/").filter(Boolean).length + 1;
        return {
          ...dir,
          isActive: true,
          currentDepth: pathDepth as TypeDirectoryDepth
        };
      }

      return {
        ...dir,
        isActive: false,
        currentDepth: undefined
      };
    });

    if (!newDirectories.find(dir => dir.fullPath === theDirectory!.fullPath)) {
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

export function useFilePreview() {
  const [previewFile, setPreviewFile] = useState<DirectoryItem>();

  const handleClosePreview = () => setPreviewFile(undefined);

  return {
    previewFile,
    setPreviewFile,
    handleClosePreview
  };
}

export function useStorageDataSync(
  directory: TypeDirectories,
  setDirectory: (dirs: TypeDirectories) => void
) {
  const {storageData} = useStorageData(directory);
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
