/**
 * @owner Kanan Gasimov
 * email: rio.kenan@gmail.com
 */

import {Table, Icon, type IconName, FlexElement} from "oziko-ui-kit";
import React, {useCallback, useMemo} from "react";
import BucketFieldPopup from "../../../molecules/bucket-field-popup/BucketFieldPopup";
import {useCreateBucketFieldMutation, useGetBucketQuery, type BucketType, type Property} from "../../../../store/api/bucketApi";
import {FieldKind, FIELD_REGISTRY} from "../../../../domain/fields";
import type {ColumnType} from "../../bucket-table/BucketTable";
import styles from "./BucketTableNew.module.scss";
import type {FieldFormState} from "../../../../domain/fields/types";
import {useBucketCellData} from "../../../../hooks/useBucketCellData";


interface BucketTableNewProps {
  bucketId: string;
  bucket?: BucketType;
  columns: ColumnType[];
  data: any[];
  onScrollEnd: () => void;
  totalDataLength: number;
  maxHeight: string | number;
  loading: boolean;
  primaryKey: string;
}

const COLUMN_ICONS: Record<string, IconName> = Object.values(FieldKind).reduce(
  (acc, k) => {
    const def = FIELD_REGISTRY[k];
    if (def) acc[k] = def.display.icon;
    return acc;
  },
  {} as Record<string, IconName>
);  

const BucketTableNew: React.FC<BucketTableNewProps> = ({ bucketId, bucket: bucketProp, columns, data, onScrollEnd, totalDataLength, maxHeight, loading, primaryKey}) => {

  // Store cell action handlers (Enter/Escape per cell)
  const cellActionsRef = React.useRef<{
    [key: string]: {
      onEnter?: () => void;
      onEscape?: () => void;
    };
  }>({});

  const {data: bucketFromQuery} = useGetBucketQuery(bucketId);
  const bucket = bucketProp || bucketFromQuery;
  const [createBucketField] = useCreateBucketFieldMutation();

  // Transform raw data into editable cells
  const {editableData} = useBucketCellData({
    bucketId,
    bucket,
    rawData: data,
    cellActionsRef
  });

  const columnsWithHeaders = useMemo(() => {
    console.log(columns, "columns");
    
    const mappedColumns = columns?.map((column: ColumnType) => {
      const icon = column.type ? COLUMN_ICONS[column.type] : undefined;

      return {
        ...column,
        header: (
          <>
            {icon && <Icon name={icon} size={16} />}
            <span
              style={{
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap"
              }}
            >
              {column.header}
            </span>
            {/* add popover here */}
          </>
        )
      };
    });

    return [...mappedColumns];
  }, [columns, bucketId]);

  const forbiddenFieldNames = useMemo(() => {
    return columns.map((column: ColumnType) => column.key);
  }, [columns]);

  const handleSaveAndClose = useCallback(
    async (values: FieldFormState, kind: FieldKind): Promise<BucketType> => {
      if (!bucket) {
        throw new Error("No bucket available");
      }

      const fieldProperty = FIELD_REGISTRY[kind]?.buildCreationFormApiProperty(values);
      const {requiredField, primaryField} = values.configurationValues;
      const {title} = values.fieldValues;

      // Build the modified bucket with new field
      const modifiedBucket = {
        ...bucket,
        properties: {
          ...bucket.properties,
          [title]: fieldProperty as Property
        },
        // Add to required array if requiredField is true
        required: requiredField ? [...(bucket.required || []), title] : bucket.required,
        // Set as primary if primaryField is true
        primary: primaryField ? title : bucket.primary
      };

      const result = await createBucketField(modifiedBucket);
      if (!result.data) {
        throw new Error("Failed to create bucket field");
      }
      return result.data;
    },
    [bucket, createBucketField]
  );

  const handleCellEnter = useCallback((columnKey: string, rowIndex: number, event: KeyboardEvent) => {
    const cellKey = `${columnKey}-${rowIndex}`;
    const actions = cellActionsRef.current[cellKey];

    if (actions?.onEnter) {
      actions.onEnter();
    }
  }, []);

  // Handle Escape key press on a cell
  const handleCellEscape = useCallback((columnKey: string, rowIndex: number, event: KeyboardEvent) => {
    const cellKey = `${columnKey}-${rowIndex}`;
    const actions = cellActionsRef.current[cellKey];

    if (actions?.onEscape) {
      actions.onEscape();
    }
  }, []);

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <FlexElement className={styles.tableContainer} dimensionX={"fill"} dimensionY={"fill"} gap={0}>
      <Table
        columns={columnsWithHeaders}
        data={editableData}
        noResizeableColumns={["_id"]}
        fixedColumns={["_id"]}
        tableClassName={styles.table}
        headerClassName={styles.header}
        columnClassName={styles.column}
        cellClassName={styles.cell}
        onCellEnter={handleCellEnter}
        onCellEscape={handleCellEscape}
        saveToLocalStorage={{
          id: `bucket-table-${bucketId}`,
          save: true
        }}
      />

      <FlexElement
        className={styles.newFieldContainer}
        direction="vertical"
        dimensionY="fill"
        alignment="leftTop"
      >
        <BucketFieldPopup
          onSaveAndClose={handleSaveAndClose}
          forbiddenFieldNames={forbiddenFieldNames}
        >
          {({onOpen}) => (
            <FlexElement className={styles.newFieldHeader} dimensionY={36} onClick={onOpen}>
              <Icon name="plus" size={16} />
              <span>New Field</span>
            </FlexElement>
          )}
        </BucketFieldPopup>
      </FlexElement>
    </FlexElement>
  );
};

export default BucketTableNew;