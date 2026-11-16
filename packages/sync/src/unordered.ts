import isPlainObject from "lodash/isPlainObject.js";

export function sortUnorderedArrays<T>(data: T, paths: string[] = []): T {
  if (!paths.length) return data;
  return visit(
    data,
    [],
    paths.map(p => p.split("."))
  ) as T;
}

function visit(node: unknown, path: string[], patterns: string[][]): unknown {
  let visited: unknown = node;
  if (Array.isArray(node)) {
    visited = node.map((item, i) => visit(item, [...path, String(i)], patterns));
  } else if (isPlainObject(node)) {
    visited = Object.fromEntries(
      Object.entries(node as Record<string, unknown>).map(([k, v]) => [
        k,
        visit(v, [...path, k], patterns)
      ])
    );
  }

  if (Array.isArray(visited) && patterns.some(p => matches(p, path))) {
    return visited
      .map(item => ({item, key: canonical(item)}))
      .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
      .map(({item}) => item);
  }
  return visited;
}

function matches(pattern: string[], path: string[]): boolean {
  if (!pattern.length) return !path.length;
  const [head, ...rest] = pattern;
  if (head === "**") {
    return matches(rest, path) || (path.length > 0 && matches(pattern, path.slice(1)));
  }
  return path.length > 0 && (head === "*" || head === path[0]) && matches(rest, path.slice(1));
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (isPlainObject(value)) {
    const obj = value as Record<string, unknown>;
    const entries = Object.keys(obj)
      .sort()
      .map(k => `${JSON.stringify(k)}:${canonical(obj[k])}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value) ?? "undefined";
}
