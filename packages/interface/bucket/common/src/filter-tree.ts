export interface FilterCondition {
  path: string[];
  operator: string;
  value: unknown;
  id?: boolean;
}

export type FilterNode = {and: FilterNode[]} | {or: FilterNode[]} | FilterCondition;

export const isCondition = (node: FilterNode): node is FilterCondition => "path" in node;

export function conditionPaths(node: FilterNode, paths: string[][] = []): string[][] {
  if (isCondition(node)) {
    paths.push(node.path);
  } else {
    for (const child of "and" in node ? node.and : node.or) {
      conditionPaths(child, paths);
    }
  }
  return paths;
}
