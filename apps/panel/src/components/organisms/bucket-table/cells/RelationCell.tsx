
/**
 * @owner Kanan Gasimov
 * email: rio.kenan@gmail.com
 */

import React, { useCallback, useMemo } from 'react'
import { useParams } from 'react-router-dom';
import { Popover } from 'oziko-ui-kit';
import type { CellRendererProps } from '../types';
import RelationPicker from '../../../prefabs/relation-picker/RelationPicker';
import type { RelationSelected } from '../../../prefabs/relation-picker/types';
import { useBucketLookup } from '../../../../contexts/BucketLookupContext';
import { extractPrimaryColumns, extractPrimaryFieldValue, readLegacyRelationLabelMode, relationLabelModeMapKey, resolveRelationFieldMode } from '../../../prefabs/relation-picker/primaryFieldUtils';
import type { RelationLabelModeMap } from '../../../prefabs/relation-picker/primaryFieldUtils';
import useLocalStorage from '../../../../hooks/useLocalStorage';
import { useCellState } from '../useCellSelection';
import styles from './Cells.module.scss';

const cx = (...classes: (string | false | undefined)[]) => classes.filter(Boolean).join(' ');

export const RelationCell: React.FC<CellRendererProps> = ({
  value,
  onChange,
  property,
  propertyKey,
  rowId,
}) => {
  const { isSelected, isEditing, select, requestEdit, exitEdit } = useCellState(rowId, propertyKey);
  const bucketLookup = useBucketLookup();
  const relatedBucketId = property.bucketId;

  // The list view honors the per-field setting of the bucket currently being
  // viewed (/bucket/:bucketId), keyed by this cell's property, not the related
  // bucket the relation points at.
  const { bucketId: viewedBucketId } = useParams<{ bucketId: string }>();
  const [relationLabelMap] = useLocalStorage<RelationLabelModeMap>(
    relationLabelModeMapKey(viewedBucketId ?? ''),
    {}
  );
  // Fall back to the deprecated per-bucket setting when this field has no explicit
  // per-field entry, so the display matches the request's resolution scope.
  const relationLabelMode =
    relationLabelMap?.[propertyKey] ??
    readLegacyRelationLabelMode(viewedBucketId ?? '') ??
    resolveRelationFieldMode(relationLabelMap, propertyKey);

  const normalizedValue: RelationSelected | null = useMemo(() => {
    if (!value || !relatedBucketId) return null;

    if (typeof value === 'object' && value.kind === 'id') {
      return value as RelationSelected;
    }

    if (typeof value === 'object' && value._id) {
      const relatedBucketProperties = bucketLookup.getBucketProperties(relatedBucketId);
      if (relatedBucketProperties) {
        const relatedPrimaryKey = bucketLookup.getBucketPrimaryKey(relatedBucketId);
        const label = extractPrimaryFieldValue(value, relatedBucketProperties, relatedPrimaryKey);
        const columns = extractPrimaryColumns(value, relatedBucketProperties, relatedPrimaryKey);

        bucketLookup.setRelationLabel(relatedBucketId, value._id, label);

        return {
          kind: 'id',
          id: value._id,
          label: label,
          columns: columns
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

  const handleSelect = useCallback((selection: any) => {
    const id = typeof selection === 'string' ? selection : selection?.id ?? null;
    onChange?.(id);
    exitEdit();
  }, [onChange, exitEdit]);

  const resolveLabel = useCallback((id: string): string | null => {
    if (!relatedBucketId) return null;
    return bucketLookup.getRelationLabel(relatedBucketId, id);
  }, [bucketLookup, relatedBucketId]);

  if (!relatedBucketId) {
    return <span>No bucket ID</span>;
  }

  // At rest the cell shows a SINGLE value: the raw id when the bucket is set to
  // "id", otherwise the resolved primary field, falling back to the id when no
  // primary value is available.
  const displayValue: string | null = (() => {
    if (!normalizedValue) return null;
    if (relationLabelMode === 'id') return normalizedValue.id;
    const primary =
      normalizedValue.columns?.[0]?.value ??
      normalizedValue.label ??
      resolveLabel(normalizedValue.id);
    return primary || normalizedValue.id;
  })();

  return (
    <Popover
      open={isEditing}
      onClose={exitEdit}
      content={
        <div className={cx(styles.complexEditorPopover, styles.relationEditorPopover)} onClick={e => e.stopPropagation()}>
          <RelationPicker
            bucketId={relatedBucketId}
            onSelect={handleSelect}
            onCancel={exitEdit}
            currentValue={normalizedValue?.id}
          />
        </div>
      }
      containerProps={{ dimensionX: "fill", dimensionY: "fill", className: styles.cellShellContainer }}
      childrenProps={{ dimensionX: "fill", dimensionY: "fill" }}
    >
      <span
        className={cx(styles.readDisplay, isSelected && styles.cellSelected)}
        onClick={e => {
          e.stopPropagation();
          isSelected ? requestEdit() : select();
        }}
        onDoubleClick={e => {
          e.stopPropagation();
          requestEdit();
        }}
      >
        {displayValue ? (
          <span className={styles.relationValue} title={displayValue}>
            {displayValue}
          </span>
        ) : null}
      </span>
    </Popover>
  );
}
