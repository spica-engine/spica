import {useState} from "react";
import useStorage from "../../hooks/useStorage";
import type {TypeFile} from "oziko-ui-kit";
import type {
  TypeDirectories,
  DirectoryItem,
  TypeDirectoryDepth
} from "../../components/organisms/storage-columns/StorageColumns";

const ROOT_PATH = "/";

const getParentPath = (fullPath?: string) => {
  const res =
    fullPath?.replace(/\/[^/]+\/?$/, "") === fullPath
      ? "/"
      : fullPath?.replace(/\/[^/]+\/?$/, "") || "/";
  return res === "/" ? res : res + "/";
};

function findMaxDepthDirectory<T extends {currentDepth?: number}>(arr: T[]): T | undefined {
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
        currentDepth: Math.min(directory.filter(dir => dir.currentDepth).length, 3),
        isActive: false
      };
    });
    return convertedData;
  };

  return {convertData};
}

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
    wasActive: boolean
  ) => {
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

export function useFilePreview() {
  const [previewFile, setPreviewFile] = useState<DirectoryItem>();

  const handleClosePreview = () => setPreviewFile(undefined);

  return {
    previewFile,
    setPreviewFile,
    handleClosePreview
  };
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
