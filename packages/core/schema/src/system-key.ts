export const SYSTEM_KEY_PLACEHOLDER = "$systemKey";

export function hasSystemKey(node: unknown): boolean {
  if (Array.isArray(node)) {
    return node.some(item => item === SYSTEM_KEY_PLACEHOLDER || hasSystemKey(item));
  }
  if (node && typeof node === "object") {
    return Object.entries(node).some(
      ([key, value]) => key === SYSTEM_KEY_PLACEHOLDER || hasSystemKey(value)
    );
  }
  return false;
}

export function withSystemKey<T>(schema: T, keyField: string): T {
  if (!hasSystemKey(schema)) {
    return schema;
  }
  return rename(schema, keyField) as T;
}

function rename(node: unknown, keyField: string): unknown {
  if (Array.isArray(node)) {
    return node.map(item => (item === SYSTEM_KEY_PLACEHOLDER ? keyField : rename(item, keyField)));
  }
  if (node && typeof node === "object") {
    return Object.fromEntries(
      Object.entries(node).map(([key, value]) => [
        key === SYSTEM_KEY_PLACEHOLDER ? keyField : key,
        rename(value, keyField)
      ])
    );
  }
  return node;
}
