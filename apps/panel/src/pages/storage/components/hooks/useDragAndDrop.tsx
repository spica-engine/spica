import type { TypeDirectories, DirectoryItem } from "src/types/storage";
import {
  useUpdateStorageNameMutation,
  useLazyGetStorageItemsQuery
} from "../../../../store/api/storageApi";
import { getParentPath, normalizePathWithTrailingSlash, updateDirectoryLists, updateStorageNames, validateDrop } from "../utils";

export function useDragAndDrop(
  directory: TypeDirectories,
  setDirectory: (dirs: TypeDirectories) => void
) {
  const [updateStorageName] = useUpdateStorageNameMutation();
  const [getStorageItems] = useLazyGetStorageItemsQuery();

  const handleDrop = async (
    draggedItem: DirectoryItem,
    targetFolderPath: string,
    sourceItems: DirectoryItem[],
    targetItems: DirectoryItem[]
  ): Promise<boolean> => {
    const oldParent = getParentPath(draggedItem.fullPath);
    const newParent = normalizePathWithTrailingSlash(targetFolderPath);

    const allItems = [...sourceItems, ...targetItems];
    const canDrop = validateDrop(draggedItem, oldParent, newParent, allItems);

    if (!canDrop) {
      console.warn("Cannot drop item here");
      return false;
    }

    const oldFullName = draggedItem.fullPath || "";
    const itemName = draggedItem.label;

    const isRootTarget = newParent === "/";
    const newFullName = isRootTarget ? itemName : newParent + itemName;

    try {
      const updatedDirectories = updateDirectoryLists({
        directory,
        item: draggedItem,
        toPath: newParent
      });
      setDirectory(updatedDirectories);

      await updateStorageNames(
        draggedItem,
        oldFullName,
        newFullName as string,
        params => updateStorageName(params).unwrap(),
        async params => {
          const {data} = await getStorageItems(params);
          return data;
        }
      );

      return true;
    } catch (error) {
      console.error("Failed to move item:", error);

      const revertedDirectories = updateDirectoryLists({
        directory,
        item: draggedItem,
        toPath: oldParent
      });
      setDirectory(revertedDirectories);

      return false;
    }
  };

  return {handleDrop};
}
