import {
  useUpdateStorageNameMutation,
  useLazyGetStorageItemsQuery
} from "../../../store/api/storageApi";
import type {DirectoryItem, TypeDirectories} from "./StorageColumns";

export const ItemTypes = {
  STORAGE_ITEM: "storage_item"
} as const;

export interface DragItem {
  id: string;
  name: string;
  fullPath: string;
  isDirectory: boolean;
  parentPath: string;
}

// Path utility functions
export function normalizePathWithTrailingSlash(path: string): string {
  return path.endsWith("/") ? path : path + "/";
}

export function isDescendantOf(childPath: string, parentPath: string): boolean {
  if (childPath === parentPath) return true;
  const normalizedChild = normalizePathWithTrailingSlash(childPath);
  const normalizedParent = normalizePathWithTrailingSlash(parentPath);
  return normalizedChild.startsWith(normalizedParent);
}

export function getParentPath(fullPath: string): string {
  return fullPath.substring(0, fullPath.lastIndexOf("/") + 1);
}

// Validation check types
type CanDropCheck = (
  oldParent: string,
  newParent: string,
  item: DirectoryItem,
  items: DirectoryItem[]
) => boolean;

// Validation checks
function isDifferentLocation(oldParent: string, newParent: string): boolean {
  return oldParent !== newParent;
}

function hasUniqueNameInTarget(
  _oldParent: string,
  newParent: string,
  item: DirectoryItem,
  items: DirectoryItem[]
): boolean {
  const targetItems = items.filter(i => {
    const itemParent = getParentPath(i.fullPath);
    return itemParent === newParent;
  });
  return !targetItems.some(i => i.label === item.label);
}

function isNotMovingFolderIntoChild(
  _oldParent: string,
  newParent: string,
  item: DirectoryItem
): boolean {
  if (!item.content || item.content.type !== "inode/directory") return true;
  const itemPath = normalizePathWithTrailingSlash(item.fullPath);
  return !isDescendantOf(newParent, itemPath);
}

export function getCanDropChecks(): CanDropCheck[] {
  return [
    (oldParent, newParent) => isDifferentLocation(oldParent, newParent),
    (oldParent, newParent, item, items) => hasUniqueNameInTarget(oldParent, newParent, item, items),
    (oldParent, newParent, item) => isNotMovingFolderIntoChild(oldParent, newParent, item)
  ];
}

// Validation helper
function validateDrop(
  draggedItem: DirectoryItem,
  oldParent: string,
  newParent: string,
  allItems: DirectoryItem[]
): boolean {
  const checks = getCanDropChecks();
  return checks.every(check => check(oldParent, newParent, draggedItem, allItems));
}

// Directory update helpers
interface DirectoryUpdateParams {
  directory: TypeDirectories;
  item: DirectoryItem;
  fromPath: string;
  toPath: string;
}

function removeItemFromDirectory(
  dir: TypeDirectories[0],
  fromPath: string,
  itemId: string
): TypeDirectories[0] {
  if (!dir.items) return dir;

  // Check if any item in this directory matches the one we want to remove
  const hasItem = dir.items.some(i => i._id === itemId);
  
  if (hasItem) {
    return {
      ...dir,
      items: dir.items.filter(i => i._id !== itemId)
    };
  }

  return dir;
}

function addItemToDirectory(
  dir: TypeDirectories[0],
  toPath: string,
  item: DirectoryItem
): TypeDirectories[0] {
  if (!dir.items) return dir;

  // Normalize paths for comparison
  const normalizedDirPath = normalizePathWithTrailingSlash(dir.fullPath);
  const normalizedToPath = normalizePathWithTrailingSlash(toPath);

  // Check if this directory is the target directory we're adding to
  const shouldAdd = normalizedDirPath === normalizedToPath;

  if (shouldAdd) {
    const isDirectory = item.content?.type === "inode/directory";
    const itemName = item.label || item.name;
    const newFullPath = toPath + itemName + (isDirectory && !itemName.endsWith("/") ? "/" : "");
    
    const newItem = {
      ...item,
      fullPath: newFullPath
    };
    return {
      ...dir,
      items: [...dir.items, newItem]
    };
  }

  return dir;
}

function updateDirectoryLists({
  directory,
  item,
  fromPath,
  toPath
}: DirectoryUpdateParams): TypeDirectories {
  return directory.map(dir => {
    let updatedDir = removeItemFromDirectory(dir, fromPath, item._id!);
    updatedDir = addItemToDirectory(updatedDir, toPath, item);
    
    if (dir.fullPath === item.fullPath) {
      const isDirectory = item.content?.type === "inode/directory";
      const itemName = item.label || item.name;
      const newFullPath = toPath + itemName + (isDirectory && !itemName.endsWith("/") ? "/" : "");
      
      return {
        ...updatedDir,
        fullPath: newFullPath,
        isActive: false,
        currentDepth: undefined
      };
    }
    
    return updatedDir;
  });
}

// Storage update helpers
interface StorageUpdateParams {
  item: DirectoryItem;
  oldFullName: string;
  newFullName: string;
  updateStorageName: (params: {id: string; name: string}) => Promise<any>;
  getStorageItems: (params: {filter: object}) => Promise<any>;
}

async function updateDirectoryStorage({
  item,
  oldFullName,
  newFullName,
  updateStorageName,
  getStorageItems
}: StorageUpdateParams): Promise<void> {
  if (!item.fullPath) return;

  const result = await getStorageItems({
    filter: {
      name: {$regex: `^${item.fullPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`}
    }
  });

  const subResources = result

  const updates = subResources.map((storage: any) => {
    const updatedName = storage.name.replace(oldFullName, newFullName);
    return updateStorageName({
      id: storage._id,
      name: updatedName
    });
  });

  await Promise.all(updates);
}

async function updateFileStorage({
  item,
  newFullName,
  updateStorageName
}: Omit<StorageUpdateParams, "oldFullName" | "getStorageItems">): Promise<void> {
  if (!item._id) return;

  await updateStorageName({
    id: item._id,
    name: newFullName
  });
}

async function updateStorageNames(
  item: DirectoryItem,
  oldFullName: string,
  newFullName: string,
  updateStorageName: (params: {id: string; name: string}) => Promise<any>,
  getStorageItems: (params: {filter: object}) => Promise<any>
): Promise<void> {
  const isDirectory = item.content?.type === "inode/directory";

  if (isDirectory) {
    await updateDirectoryStorage({
      item,
      oldFullName,
      newFullName,
      updateStorageName,
      getStorageItems
    });
  } else {
    await updateFileStorage({
      item,
      newFullName,
      updateStorageName
    });
  }
}

// Main hook
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

    // Validate drop operation
    const allItems = [...sourceItems, ...targetItems];
    const canDrop = validateDrop(draggedItem, oldParent, newParent, allItems);

    if (!canDrop) {
      console.warn("Cannot drop item here");
      return false;
    }

    const oldFullName = draggedItem.fullPath || "";
    const itemName = draggedItem.label;
    
    // For root directory, omit the leading slash
    const isRootTarget = newParent === "/";
    const newFullName = isRootTarget ? itemName : newParent + itemName;

    try {
      const updatedDirectories = updateDirectoryLists({
        directory,
        item: draggedItem,
        fromPath: oldParent,
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
        fromPath: newParent,
        toPath: oldParent
      });
      setDirectory(revertedDirectories);

      return false;
    }
  };

  return {
    handleDrop
  };
}
