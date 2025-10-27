import type { TypeDirectories, DirectoryItem } from "src/types/storage";
import { ROOT_PATH } from "../constants";

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