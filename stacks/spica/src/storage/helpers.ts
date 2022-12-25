import {StorageNode, Storage} from "./interfaces/storage";

export const listDirectoriesRegex = "^/[^/]+/$|^[^/]+/$";

const storageNodeKeys = ["parent", "children", "depth", "isDirectory", "isHighlighted"];
export const isStorageNode = (storage: Storage | StorageNode): storage is StorageNode => {
  return Object.keys(storage).some(s => storageNodeKeys.includes(s));
};

export const isRootDir = (storageOrNode: Storage | StorageNode) => {
  if (!isDirectory(storageOrNode)) {
    return false;
  }

  if (isStorageNode(storageOrNode)) {
    return !storageOrNode.parent;
  } else {
    return (
      storageOrNode.name.endsWith("/") &&
      storageOrNode.name.split("/").filter(p => p != "").length == 1
    );
  }
};

export function getFullName(storage: StorageNode, suffix?: string) {
  const newName = suffix ? `${storage.name}/${suffix}` : storage.name;
  if (storage.parent) {
    return getFullName(storage.parent, newName);
  } else {
    return newName;
  }
}

export function isDirectory(storage: StorageNode | Storage) {
  return storage.content.size == 0 && storage.content.type == "";
}

export function findNodeById(_id: string, storages: StorageNode[]) {
  let targetNode:StorageNode;

  const find = (node: StorageNode) => {
    if (node._id == _id) {
      targetNode = node;
      return;
    }

    if (node.children) {
      node.children.forEach(n => find(n));
    }
  };

  storages.forEach(s => find(s));

  return targetNode;
}
