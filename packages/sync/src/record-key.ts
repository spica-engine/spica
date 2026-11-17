export const KEY_FIELDS = ["_id", "id"];

export const SYSTEM_KEY_FIELDS: Record<string, string> = {
  mongodb: KEY_FIELDS[0],
  postgresql: KEY_FIELDS[1]
};

export function recordKeyField(record: unknown): string | undefined {
  if (record === null || typeof record != "object") {
    return undefined;
  }
  return KEY_FIELDS.find(field => field in record);
}

export function recordKey(record: unknown): string | undefined {
  const field = recordKeyField(record);
  return field ? (record as Record<string, string>)[field] : undefined;
}

export async function fetchSystemKeyField(http: {
  get<T = unknown>(path: string): Promise<T>;
}): Promise<string> {
  const {engine} = await http.get<{engine: string}>("status/engine");
  const field = SYSTEM_KEY_FIELDS[engine];
  if (!field) {
    throw new Error(`Unknown database engine "${engine}".`);
  }
  return field;
}
