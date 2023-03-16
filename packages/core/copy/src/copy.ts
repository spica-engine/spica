/**
 * Deep copies and returns copied object
 * @param param Object that will be deeply copied
 * @returns Deeply copied object
 */
export function deepCopyJSON(param) {
  return JSON.parse(JSON.stringify(param));
}
