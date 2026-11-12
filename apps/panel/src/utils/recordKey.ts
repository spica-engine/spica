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
