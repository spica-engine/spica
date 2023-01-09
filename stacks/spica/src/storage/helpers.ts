import {StorageNode, Storage} from "./interfaces/storage";

function generateRegexFilter($regex: string) {
  return {
    name: {$regex}
  };
}

export namespace Filters {
  // prettier-ignore
  export const ListRootDirs = generateRegexFilter("^[^\/]+\/$");
  // prettier-ignore
  export const ListOnlyObjects = generateRegexFilter("^.*[^\/]$");
  export const Match = name => generateRegexFilter(`^${name}$`);
  export const ListFirstChildren = (dir, itself = false) => {
    let regex = `^${dir}[^\/]+\/?$`;

    if (itself) {
      regex = `${regex}|^${dir}$`;
    }

    return generateRegexFilter(regex);
  };
  export const ListAllChildren = (dir, itself = false) => {
    let regex = `^${dir}.+`;

    if (itself) {
      regex = `${regex}|^${dir}$`;
    }

    return generateRegexFilter(regex);
  };
}

const storageNodeKeys = ["parent", "children", "depth", "isDirectory", "isHighlighted", "index"];

export function getFullName(node: StorageNode, suffix?: string): string {
  const newName = suffix
    ? `${node.name}/${suffix}`
    : node.isDirectory
    ? `${node.name}/`
    : node.name;

  return node.parent ? getFullName(node.parent, newName) : newName;
}

export function isDirectory(storage: StorageNode | Storage) {
  return storage.content.size == 0 && storage.content.type == "";
}

export function findNodeByName(name: string, nodes: StorageNode[]) {
  let targetNode: StorageNode;

  const find = (node: StorageNode) => {
    if (getFullName(node) == name) {
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

export function mapNodesToObjects(nodes: StorageNode[]): Storage[] {
  const objects = [];

  const mapNodeToObject = (node: StorageNode) => {
    if (node.children) {
      node.children.forEach(mapNodeToObject);
    }

    node.name = getFullName(node);
    storageNodeKeys.forEach(key => delete node[key]);
    objects.push(node);
  };

  nodes.forEach(mapNodeToObject);

  return objects;
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
        isDirectory: true,
        isHighlighted: false
      });
    }

    const currentNode = compare.find(c => c.name == root);
    const newObj: any = {
      name: parts.slice(1, parts.length).join("/")
    };

    const hasChild = newObj.name != "";

    if (hasChild) {
      currentNode.content = {type: "", size: 0};
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

export function getCanDropChecks(): CanDropCheck[] {
  const isDifferentNode: CanDropCheck = (oldParent, newParent, node) =>
    getFullName(oldParent) != getFullName(newParent);

  const isNameUnique: CanDropCheck = (oldParent, newParent, node) =>
    newParent.children.every(c => c.name != node.name);

  const isNotChildDir: CanDropCheck = (oldParent, newParent, node) => {
    if (!node.isDirectory) {
      return true;
    }

    return !findNodeByName(getFullName(newParent), [node]);
  };

  return [isDifferentNode, isNameUnique, isNotChildDir];
}

export type CanDropCheck = (
  oldParent: StorageNode,
  newParent: StorageNode,
  node: StorageNode
) => boolean;
