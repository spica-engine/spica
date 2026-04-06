
/**
 * @owner Kanan Gasimov
 * email: rio.kenan@gmail.com
 */
 
import React, { useCallback, useMemo } from 'react'
import type { CellRendererProps } from '../types';
import { BaseCellRenderer } from './BaseCellRenderer';
import RelationMinimized from '../../../prefabs/relation-picker/RelationMinimized';
import type { RelationSelected } from '../../../prefabs/relation-picker/types';
import { useBucketLookup } from '../../../../contexts/BucketLookupContext';
import { extractPrimaryFieldValue } from '../../../prefabs/relation-picker/primaryFieldUtils';

export const RelationCell: React.FC<CellRendererProps> = ({
  value,
  onChange,
  property,
  isFocused,
  onRequestBlur,
}) => {     
  const bucketLookup = useBucketLookup();
  const relatedBucketId = property.bucketId;

  const normalizedValue: RelationSelected | null = useMemo(() => {
    if (!value || !relatedBucketId) return null;

    if (typeof value === 'object' && value.kind === 'id') {
      return value as RelationSelected;
    }

    if (typeof value === 'object' && value._id) {
      const relatedBucketProperties = bucketLookup.getBucketProperties(relatedBucketId);
      if (relatedBucketProperties) {
        const label = extractPrimaryFieldValue(value, relatedBucketProperties);
        
        bucketLookup.setRelationLabel(relatedBucketId, value._id, label);
        
        return {
          kind: 'id',
          id: value._id,
          label: label
        };
      }
      // Fallback if no properties available
      return {
        kind: 'id',
        id: value._id
      };
    }

    // Case 3: Value is a plain ID string
    if (typeof value === 'string') {
      return {
        kind: 'id',
        id: value
      };
    }

    return null;
  }, [value, relatedBucketId, bucketLookup]);

  const handleChange = useCallback((selectedValue: RelationSelected | null) => {
 
    onChange?.(selectedValue?.id ?? null);
    onRequestBlur?.();
  }, [onChange]);

  const resolveLabel = useCallback((id: string): string | null => {
    if (!relatedBucketId) return null;
    return bucketLookup.getRelationLabel(relatedBucketId, id);
  }, [bucketLookup, relatedBucketId]);

  if (!relatedBucketId) {
    return <BaseCellRenderer isFocused={isFocused}>No bucket ID</BaseCellRenderer>;
  }

  const relatedBucketTitle = bucketLookup.getTitleById(relatedBucketId) ?? 'Unknown bucket';
  const emptyLabel = `Select from ${relatedBucketTitle}`;

  return (
    <BaseCellRenderer isFocused={isFocused}>
      <RelationMinimized
        bucketId={relatedBucketId}
        value={normalizedValue}
        onChange={handleChange}
        emptyLabel={emptyLabel}
        resolveLabel={resolveLabel}
      />
    </BaseCellRenderer>
  )
}
