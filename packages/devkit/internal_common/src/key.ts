export function idOf(record: unknown): string | undefined {
  if (record === null || typeof record != "object") {
    return undefined;
  }
  if ("_id" in record) {
    return record["_id"] as string;
  }
  if ("id" in record) {
    return record["id"] as string;
  }
  return undefined;
}
