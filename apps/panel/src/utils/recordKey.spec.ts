import { describe, it, expect } from '@jest/globals';
import { idOf, omitId, type SystemRecord } from './recordKey';

describe.each([
  ['MongoDB', '_id'],
  ['PostgreSQL', 'id']
])('record key (%s records)', (_engine, key) => {
  const record = { [key]: 'k1', name: 'a' } as SystemRecord & { name: string };

  it('should read the key', () => {
    expect(idOf(record)).toBe('k1');
  });

  it('should drop the key and keep the rest', () => {
    expect(omitId(record)).toEqual({ name: 'a' });
  });
});

describe('idOf', () => {
  it('should be undefined for a record without a key or no record at all', () => {
    expect(idOf({})).toBeUndefined();
    expect(idOf(undefined)).toBeUndefined();
    expect(idOf(null)).toBeUndefined();
  });

  it('should prefer the MongoDB name when a record somehow carries both', () => {
    expect(idOf({ _id: 'a', id: 'b' })).toBe('a');
  });
});
