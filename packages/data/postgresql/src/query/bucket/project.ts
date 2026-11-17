type Document = Record<string, any>;

function copyPath(source: Document, target: Document, path: string[]) {
  let value: unknown = source;
  for (const segment of path) {
    if (value == null || typeof value != "object" || !(segment in value)) {
      return;
    }
    value = (value as Document)[segment];
  }

  let to = target;
  for (const segment of path.slice(0, -1)) {
    to = to[segment] ??= {};
  }
  to[path[path.length - 1]] = value;
}

export function projectDocument(
  document: Document,
  projectMap: string[][],
  keyField: string
): Document {
  if (!projectMap.length) {
    return document;
  }
  const projected: Document = {};
  for (const path of [[keyField], ...projectMap]) {
    copyPath(document, projected, path);
  }
  return projected;
}
