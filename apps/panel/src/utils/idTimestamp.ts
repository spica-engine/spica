const OBJECT_ID = /^[0-9a-f]{24}$/i;
const UUID_V7 = /^([0-9a-f]{8})-([0-9a-f]{4})-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function timestampFromId(id: string | undefined | null): number | undefined {
  if (!id) return undefined;

  if (OBJECT_ID.test(id)) {
    return Number.parseInt(id.slice(0, 8), 16) * 1000;
  }

  const uuid = UUID_V7.exec(id);
  if (uuid) {
    return Number.parseInt(uuid[1] + uuid[2], 16);
  }

  return undefined;
}

export function creationDate(record: {created_at?: string} | undefined | null, id: string | undefined): Date {
  if (record?.created_at) {
    const parsed = new Date(record.created_at);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  return new Date(timestampFromId(id) ?? Number.NaN);
}
