import type { TypeFilterValue } from "oziko-ui-kit";
import type {DirectoryItem, TypeDirectories, TypeFileSizeUnit} from "../../types/storage";
import { convertQuickDateToRange } from "../../utils/storage";

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
    (oldParent, newParent, item, items) => hasUniqueNameInTarget(oldParent, newParent, item, items),
    (oldParent, newParent, item) => isNotMovingFolderIntoChild(oldParent, newParent, item)
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


export function buildApiFilter(filterValue: TypeFilterValue): object {
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