/**
 * @owner Kanan Gasimov
 * email: rio.kenan@gmail.com
 */

import React, { useCallback } from 'react';
import type { FilterInputHandlerProps } from './FilterInputHandlerRegistry';
import type { Property } from '../../../../store/api/bucketApi';
import RelationMinimized from '../../relation-picker/RelationMinimized';
import type { RelationSelected } from '../../relation-picker/types';
import { extractRelationId } from '../../relation-picker/types';
import { useBucketLookup } from '../../../../contexts/BucketLookupContext';
import { Text } from 'oziko-ui-kit';

const RelationInputHandler: React.FC<FilterInputHandlerProps> = ({
  condition,
  property,
  value,
  onChange
}) => {
  const relationProperty = property as Property & { bucketId: string };
  const bucketId = relationProperty.bucketId;
  const bucketLookup = useBucketLookup();


  const handleChange = useCallback((selectedValue: RelationSelected | null) => {
    onChange(selectedValue);
  }, [onChange]);

  const resolveLabel = useCallback((id: string): string | null => {
    return bucketLookup.getRelationLabel(bucketId, id);
  }, [bucketLookup, bucketId]);

  if (!bucketId) {
    return <Text size="medium">No bucket ID configured</Text>;
  }

  const relatedBucketTitle = bucketLookup.getTitleById(bucketId) ?? 'Unknown bucket';
  const emptyLabel = `Select from ${relatedBucketTitle}`;

  const normalizedValue: RelationSelected | null = (() => {
    if (!value) return null;
    
    if (typeof value === 'object' && value.kind === 'id') {
      return value as RelationSelected;
    }
    
    const id = extractRelationId(value);
    if (id) {
      return { kind: 'id', id };
    }
    
    return null;
  })();


  return (
    <RelationMinimized
      bucketId={bucketId}
      value={normalizedValue}
      onChange={handleChange}
      emptyLabel={emptyLabel}
      resolveLabel={resolveLabel}
      resetKey={condition.id}
    />
  );
};

export default RelationInputHandler;
