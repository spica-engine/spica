import { useState } from "react";
import type { TypeDirectories, TypeDirectoryDepth } from "src/types/storage";
import { getParentPath } from "../utils";
import { ROOT_PATH } from "../constants";

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
    console.log("Building ancestor paths for:", fullPath);
    while (currentPath !== ROOT_PATH) {
      console.log("Adding ancestor path:", currentPath);
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