
/**
 * @owner Kanan Gasimov
 * email: rio.kenan@gmail.com
 */
 
import React, { useCallback, useMemo } from 'react'
import type { CellRendererProps } from '../types';
import RelationMinimized from '../../../prefabs/relation-picker/RelationMinimized';
import type { RelationSelected } from '../../../prefabs/relation-picker/types';
import { useBucketLookup } from '../../../../contexts/BucketLookupContext';
import { extractPrimaryFieldValue } from '../../../prefabs/relation-picker/primaryFieldUtils';

export const RelationCell: React.FC<CellRendererProps> = ({
  value,
  onChange,
  property,
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
      return {
        kind: 'id',
        id: value._id
      };
    }

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
  }, [onChange]);

  const resolveLabel = useCallback((id: string): string | null => {
    if (!relatedBucketId) return null;
    return bucketLookup.getRelationLabel(relatedBucketId, id);
  }, [bucketLookup, relatedBucketId]);

  if (!relatedBucketId) {
    return <span>No bucket ID</span>;
  }

  const relatedBucketTitle = bucketLookup.getTitleById(relatedBucketId) ?? 'Unknown bucket';
  const emptyLabel = `Select from ${relatedBucketTitle}`;

  return (
    <RelationMinimized
      bucketId={relatedBucketId}
      value={normalizedValue}
      onChange={handleChange}
      emptyLabel={emptyLabel}
      resolveLabel={resolveLabel}
    />
  )
}
