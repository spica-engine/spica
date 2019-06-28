/**
 * Sets property of the given object by path
 * @param object
 * @param path
 * @param value
 * @returns
 */
export function setPropertyByPath(object: any, path: Array<any>, value) {
  for (let i = 0; i < path.length - 1; i++) {
    object = object[path[i]];
  }
  object[path[path.length - 1]] = value;
  return object;
}

/**
 * Resolves given object by path array
 * @param path
 * @param obj
 * @returns
 */
export function resolve(path: Array<string>, obj: Object): string | number | boolean {
  return path.reduce((prev, curr) => {
    return prev ? prev[curr] : null;
  }, obj || this);
}
