export interface SystemRecord {
  _id?: string;
  id?: string;
}

export function idOf(record: SystemRecord | null | undefined): string | undefined {
  return record?._id ?? record?.id;
}

export function omitId<T extends SystemRecord>(record: T): Omit<T, '_id' | 'id'> {
  const { _id, id, ...rest } = record;
  return rest;
}
