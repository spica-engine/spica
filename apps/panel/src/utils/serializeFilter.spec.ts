import { describe, it, expect } from '@jest/globals';
import { serializeFilter } from './serializeFilter';

describe('serializeFilter', () => {
  it('should write a MongoDB filter as JSON', () => {
    expect(serializeFilter({ name: { $regex: 'a', $options: 'i' } })).toBe(
      '{"name":{"$regex":"a","$options":"i"}}'
    );
  });

  it('should pass an expression through without quoting it', () => {
    expect(serializeFilter('document.age > 1 && document.name == "a"')).toBe(
      'document.age > 1 && document.name == "a"'
    );
  });
});
