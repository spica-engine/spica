import {StorageNode, Storage} from "./interfaces/storage";

function regexFilterGenerator($regex: string) {
  return {
    name: {$regex}
  };
}

export namespace Filters {
  // prettier-ignore
  export const ListRootDirs = regexFilterGenerator("^\/[^\/]+\/$|^[^\/]+\/$");
  // prettier-ignore
  export const ListOnlyObjects = regexFilterGenerator("^.*[^\/]$");
  export const ListUnderDirFirstDepth = dir =>
    regexFilterGenerator(`^${dir}\/$|^${dir}\/[^\/]+\/?$`);
  export const listUnderDirAll = dir => regexFilterGenerator(`^${dir}\/`);
}

const storageNodeKeys = ["parent", "children", "depth", "isDirectory", "isHighlighted", "index"];
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

export function getFullName(node: StorageNode, suffix?: string) {
  const newName = suffix ? `${node.name}/${suffix}` : node.name;
  if (node.parent) {
    return getFullName(node.parent, newName);
  } else {
    return newName;
  }
}

export function isDirectory(storage: StorageNode | Storage) {
  return storage.content.size == 0 && storage.content.type == "";
}

export function findNodeById(_id: string, nodes: StorageNode[]) {
  let targetNode: StorageNode;

  const find = (node: StorageNode) => {
    if (node._id == _id) {
      targetNode = node;
      return;
    }

    if (node.children) {
      node.children.forEach(n => find(n));
    }
  };

  nodes.forEach(s => find(s));

  return targetNode;
}

export function mapNodesToObjects(nodes: StorageNode[]) {
  nodes.forEach(node => {
    node.name = getFullName(node);
    storageNodeKeys.forEach(key => delete node[key]);
  });

  return nodes;
}

export function mapObjectsToNodes(objects: (StorageNode | Storage)[]) {
  let result: StorageNode[] = [];

  const mapPath = (obj: Storage, compare: StorageNode[], parent: StorageNode, index: number) => {
    const parts = obj.name.split("/").filter(p => p != "");
    const root = parts[0];

    const doesNotExist = !compare.some(c => c.name == root);
    if (doesNotExist) {
      compare.push({
        name: root,
        children: [],
        parent,
        isDirectory: false,
        isHighlighted: false
      });
    }

    const currentNode = compare.find(c => c.name == root);
    const newObj: any = {
      name: parts.slice(1, parts.length).join("/")
    };

    const hasChild = newObj.name != "";

    if (hasChild) {
      newObj.content = obj.content;
      newObj.url = obj.url;
      newObj._id = obj._id;
      newObj.isDirectory = isDirectory(obj);
      mapPath(newObj, currentNode.children, currentNode, index);
    } else {
      currentNode.content = obj.content;
      currentNode.url = obj.url;
      currentNode._id = obj._id;
      currentNode.isDirectory = isDirectory(obj);
      currentNode.index = index;
      currentNode.children.sort((a, b) => a.index - b.index);
    }
  };

  for (let [i, object] of objects.entries()) {
    mapPath(object, result, undefined, i);
  }

  return result;
}
