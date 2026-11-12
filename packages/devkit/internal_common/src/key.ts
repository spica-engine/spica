export const KEY_FIELDS = ["_id", "id"];

export function idOf(record: unknown): string | undefined {
  if (record === null || typeof record != "object") {
    return undefined;
  }
  const field = KEY_FIELDS.find(name => name in record);
  return field ? (record[field] as string) : undefined;
}
