import { describe, it, expect } from '@jest/globals';
import { idOf, omitId, pickId, principalKeyFor, type SystemRecord } from './recordKey';

describe.each([
  ['MongoDB', '_id'],
  ['PostgreSQL', 'id']
])('record key (%s records)', (_engine, key) => {
  const record = { [key]: 'k1', name: 'a' } as SystemRecord & { name: string };

  it('should read the key', () => {
    expect(idOf(record)).toBe('k1');
  });

  it('should keep only the key under its own name', () => {
    expect(pickId(record)).toEqual({ [key]: 'k1' });
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

  it('should pick nothing from a record without a key', () => {
    expect(pickId({})).toEqual({});
  });

  it('should prefer the MongoDB name when a record somehow carries both', () => {
    expect(idOf({ _id: 'a', id: 'b' })).toBe('a');
  });
});

describe('principalKeyFor', () => {
  it('should name the key the way the engine does', () => {
    expect(principalKeyFor('postgresql')).toBe('id');
    expect(principalKeyFor('mongodb')).toBe('_id');
  });

  it('should default to the MongoDB name until the engine is known', () => {
    expect(principalKeyFor(undefined)).toBe('_id');
  });
});
