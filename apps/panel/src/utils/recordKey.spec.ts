import { describe, it, expect } from '@jest/globals';
import { idOf, omitId, pickId, principalKeyFor, bucketKeyField, keyOf, omitKey, type SystemRecord } from './recordKey';

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

describe('bucket document keys', () => {
  it('should find the key field the way the engine defines it', () => {
    expect(bucketKeyField('mongodb', { primary: 'title' })).toBe('_id');
    expect(bucketKeyField('postgresql', { primary: 'sku' })).toBe('sku');
    expect(bucketKeyField('postgresql', {})).toBeUndefined();
    expect(bucketKeyField(undefined, { primary: 'sku' })).toBeUndefined();
  });

  it('should read a key as a string whatever its type', () => {
    expect(keyOf({ sku: 7 }, 'sku')).toBe('7');
    expect(keyOf({ sku: 'a' }, 'sku')).toBe('a');
    expect(keyOf({ sku: 0 }, 'sku')).toBe('0');
    expect(keyOf({}, 'sku')).toBe('');
    expect(keyOf(null, 'sku')).toBe('');
    expect(keyOf({ sku: 'a' }, undefined)).toBe('');
  });

  it('should drop only the key field', () => {
    expect(omitKey({ sku: 7, title: 't' }, 'sku')).toEqual({ title: 't' });
    expect(omitKey({ sku: 7, title: 't' }, undefined)).toEqual({ sku: 7, title: 't' });
  });
});
