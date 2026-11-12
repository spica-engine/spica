import type {DataEngine} from '../store/api/statusApi';

export interface SystemRecord {
  _id?: string;
  id?: string;
}

export function idOf(record: SystemRecord | null | undefined): string | undefined {
  return record?._id ?? record?.id;
}

export function pickId(record: SystemRecord): SystemRecord {
  const { _id, id } = record;
  return _id !== undefined ? { _id } : id !== undefined ? { id } : {};
}

export function omitId<T extends SystemRecord>(record: T): Omit<T, '_id' | 'id'> {
  const { _id, id, ...rest } = record;
  return rest;
}

export const principalKeyFor = (engine: DataEngine | undefined): string =>
  engine === 'postgresql' ? 'id' : '_id';

export const bucketKeyField = (
  engine: DataEngine | undefined,
  bucket: { primary?: string } | undefined | null
): string | undefined =>
  engine === 'postgresql' ? bucket?.primary || undefined : engine === 'mongodb' ? '_id' : undefined;

export const keyOf = (row: Record<string, any> | null | undefined, keyField: string | undefined): string => {
  const value = keyField ? row?.[keyField] : undefined;
  return value === undefined || value === null ? '' : String(value);
};

export const omitKey = <T extends Record<string, any>>(row: T, keyField: string | undefined): Partial<T> => {
  if (!keyField) return row;
  const { [keyField]: _key, ...rest } = row;
  return rest as Partial<T>;
};
