import type {DirectoryItem, TypeDirectories} from "src/types/storage";

export function findMaxDepthDirectory<T extends {currentDepth?: number}>(arr: T[]): T | undefined {
  return arr.reduce<T | undefined>((max, obj) => {
    if (obj.currentDepth === undefined) return max;
    if (!max || max.currentDepth === undefined || obj.currentDepth > max.currentDepth) return obj;
    return max;
  }, undefined);
}

export function normalizePathWithTrailingSlash(path: string): string {
  return path.endsWith("/") ? path : path + "/";
}

export const getParentPath = (fullPath?: string) => {
  const res =
    fullPath?.replace(/\/[^/]+\/?$/, "") === fullPath
      ? "/"
      : fullPath?.replace(/\/[^/]+\/?$/, "") || "/";
  return res === "/" ? res : res + "/";
};


function isDifferentLocation(oldParent: string, newParent: string): boolean {
  return oldParent !== newParent;
}

function hasUniqueNameInTarget(
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
  newParent: string,
  item: DirectoryItem
): boolean {
  if (!item.content || item.content.type !== "inode/directory") return true;
  const itemPath = normalizePathWithTrailingSlash(item.fullPath);
  if (newParent === itemPath) return false;
  const normalizedChild = normalizePathWithTrailingSlash(newParent);
  const normalizedParent = normalizePathWithTrailingSlash(itemPath);
  return !normalizedChild.startsWith(normalizedParent);
}

type CanDropCheck = (
  oldParent: string,
  newParent: string,
  item: DirectoryItem,
  items: DirectoryItem[]
) => boolean;

function getCanDropChecks(): CanDropCheck[] {
  return [
    (oldParent, newParent) => isDifferentLocation(oldParent, newParent),
    (_oldParent, newParent, item, items) => hasUniqueNameInTarget(newParent, item, items),
    (_oldParent, newParent, item) => isNotMovingFolderIntoChild(newParent, item)
  ];
}

export function validateDrop(
  draggedItem: DirectoryItem,
  oldParent: string,
  newParent: string,
  allItems: DirectoryItem[]
): boolean {
  const checks = getCanDropChecks();
  return checks.every(check => check(oldParent, newParent, draggedItem, allItems));
}

export function removeItemFromDirectory(
  dir: TypeDirectories[0],
  itemId: string
): TypeDirectories[0] {
  if (!dir.items) return dir;

  const hasItem = dir.items.some(i => i._id === itemId);

  if (hasItem) {
    return {
      ...dir,
      items: dir.items.filter(i => i._id !== itemId)
    };
  }

  return dir;
}

export function addItemToDirectory(
  dir: TypeDirectories[0],
  toPath: string,
  item: DirectoryItem
): TypeDirectories[0] {
  if (!dir.items) return dir;

  const normalizedDirPath = normalizePathWithTrailingSlash(dir.fullPath);
  const normalizedToPath = normalizePathWithTrailingSlash(toPath);

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

interface DirectoryUpdateParams {
  directory: TypeDirectories;
  item: DirectoryItem;
  toPath: string;
}

export function updateDirectoryLists({
  directory,
  item,
  toPath
}: DirectoryUpdateParams): TypeDirectories {
  return directory.map(dir => {
    let updatedDir = removeItemFromDirectory(dir, item._id!);
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
  const normalizedPath = oldFullName.startsWith("/") ? oldFullName.slice(1) : oldFullName;
  const subResources =
    (await getStorageItems({
      filter: {
        name: {$regex: `^${normalizedPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`}
      }
    })) || [];

  const updates = subResources.map((storage: any) => {
    const updatedName = storage.name.replace(normalizedPath, newFullName);
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

export async function updateStorageNames(
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
