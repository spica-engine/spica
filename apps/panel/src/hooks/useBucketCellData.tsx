/**
 * @owner Kanan Gasimov
 * email: rio.kenan@gmail.com
 */

import {useMemo, useCallback} from "react";
import {useUpdateBucketEntryMutation} from "../store/api/bucketApi";
import type {BucketType} from "../services/bucketService";
import {FIELD_REGISTRY, FieldKind} from "../domain/fields";
import {getCellRenderer} from "../components/organisms/bucket/bucket-table-new/cellRenderers";
import React from "react";

interface UseBucketCellDataProps {
  bucketId: string;
  bucket: BucketType | undefined;
  rawData: any[];
  cellActionsRef: React.MutableRefObject<{
    [key: string]: {
      onEnter?: () => void;
      onEscape?: () => void;
    };
  }>;
}

interface UseBucketCellDataResult {
  editableData: any[];
  handleCellSave: (rowId: string, fieldKey: string, newValue: any) => Promise<void>;
  isUpdating: boolean;
}

export function useBucketCellData({
  bucketId,
  bucket,
  rawData,
  cellActionsRef
}: UseBucketCellDataProps): UseBucketCellDataResult {
  const [updateBucketEntry, {isLoading: isUpdating}] = useUpdateBucketEntryMutation();

  // Register cell action handler
  const registerCellAction = useCallback(
    (
      columnKey: string,
      rowIndex: number,
      actions: {onEnter?: () => void; onEscape?: () => void}
    ) => {
      const cellKey = `${columnKey}-${rowIndex}`;
      cellActionsRef.current[cellKey] = actions;
    },
    [cellActionsRef]
  );

  // Handle cell save
  const handleCellSave = useCallback(
    async (rowId: string, fieldKey: string, newValue: any) => {
      if (!bucket) {
        console.error("No bucket available for saving cell data");
        return;
      }

      try {
        const property = bucket.properties[fieldKey];
        if (!property) {
          console.error(`Property ${fieldKey} not found in bucket`);
          return;
        }

        const fieldType = property.type as FieldKind;
        const fieldDefinition = FIELD_REGISTRY[fieldType];

        // Transform value using field definition's getSaveReadyValue
        const saveReadyValue = fieldDefinition?.getSaveReadyValue
          ? fieldDefinition.getSaveReadyValue(newValue, property)
          : newValue;

        // Update the entry
        await updateBucketEntry({
          bucketId,
          entryId: rowId,
          data: {[fieldKey]: saveReadyValue}
        }).unwrap();

        console.log(`Successfully saved ${fieldKey} for entry ${rowId}`);
      } catch (error) {
        console.error("Failed to save cell data:", error);
        // TODO: Add toast notification for error
      }
    },
    [bucketId, bucket, updateBucketEntry]
  );

  // Transform raw data into editable cells
  const editableData = useMemo(() => {
    if (!bucket || !rawData?.length) {
      return rawData;
    }

    return rawData.map((row, rowIndex) => {
      const editableRow: any = {};

      // First, add all bucket properties (ensures empty fields are rendered)
      Object.keys(bucket.properties).forEach(fieldKey => {
        const property = bucket.properties[fieldKey];
        const value = row[fieldKey];
        const fieldType = property.type as FieldKind;
        const CellRenderer = getCellRenderer(fieldType);

        editableRow[fieldKey] = (
          <CellRenderer
            value={value}
            fieldKey={fieldKey}
            rowId={row._id}
            rowIndex={rowIndex}
            property={property}
            onSave={(newValue) => handleCellSave(row._id, fieldKey, newValue)}
            registerCellAction={registerCellAction}
          />
        );
      });

      // Then, add non-property fields (like _id) that exist in the row
      Object.keys(row).forEach(fieldKey => {
        if (!bucket.properties[fieldKey]) {
          editableRow[fieldKey] = row[fieldKey];
        }
      });

      return editableRow;
    });
  }, [bucket, rawData, handleCellSave, registerCellAction]);

  return {
    editableData,
    handleCellSave,
    isUpdating
  };
}

