import React, { useCallback, useMemo } from "react";
import {FlexElement, Icon, Table, type TableColumn } from "oziko-ui-kit";
import type { BucketSchema, BucketDataRow, BucketProperty } from "./types";
import { EditableCell } from "./EditableCell";
import styles from "./BucketTableNew.module.scss";
import type {FieldFormState} from "../../../domain/fields/types";
import type {BucketType} from "../../../store/api/bucketApi";
import { FIELD_REGISTRY } from "../../../domain/fields/registry";
import { FieldKind } from "../../../domain/fields/types";
import { useCreateBucketFieldMutation } from "../../../store/api/bucketApi";
import { useBucketData } from "../../../hooks/useBucketData";
import BucketFieldPopup from "../../molecules/bucket-field-popup/BucketFieldPopup";
interface BucketTableNewProps {
  bucket: BucketSchema;
  data: BucketDataRow[];
  onDataChange?: (rowId: string, propertyKey: string, newValue: any) => void;
}

/**
 * BucketTableNew - Main table component for displaying and editing bucket data
 * 
 * Architecture:
 * - Uses the generic Table component for layout and navigation
 * - Generates columns dynamically from bucket schema
 * - Each cell type is handled by its own component (via EditableCell wrapper)
 * - Completely extensible - new cell types can be added without modifying this component
 */
const BucketTableNew: React.FC<BucketTableNewProps> = ({ 
  bucket, 
  data,
  onDataChange 
}) => {
  /**
   * Get appropriate column width based on property type
   */
  const getColumnWidth = (type: string): string => {
    const widthMap: Record<string, string> = {
      string: "200px",
      textarea: "300px",
      number: "150px",
      date: "180px",
      relation: "200px",
      boolean: "100px",
      array: "250px",
      object: "250px",
    };

    return widthMap[type] || "200px";
  };

  /**
   * Handle value changes from cells
   */
  const handleValueChange = (propertyKey: string, rowId: string, newValue: any) => {
    onDataChange?.(rowId, propertyKey, newValue);
  };

  /**
   * Generate table columns from bucket properties
   */
  const columns = useMemo((): TableColumn<BucketDataRow>[] => {
    if (!bucket?.properties) return [];

    const propertyEntries = Object.entries(bucket.properties);

    return propertyEntries.map(([key, property]: [string, BucketProperty]) => ({
      key,
      header: property.title || key,
      width: getColumnWidth(property.type),
      renderCell: (params: { row: BucketDataRow; isFocused: boolean }) => {
        const value = params.row[key];
        
        return (
          <EditableCell
            value={value}
            propertyKey={key}
            property={property}
            rowId={params.row._id}
            isFocused={params.isFocused}
            onValueChange={handleValueChange}
            onRequestBlur={() => {}}
          />
        );
      },
    }));
  }, [bucket, handleValueChange, getColumnWidth]);

  if (!bucket?.properties) {
    return (
      <div className={styles.emptyState}>
        <p>No bucket schema available</p>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className={styles.emptyState}>
        <p>No data available</p>
      </div>
    );
  }

  const {bucketData} = useBucketData(bucket._id, {bucketId: bucket._id});
  const [createBucketField] = useCreateBucketFieldMutation();


  const handleSaveAndClose = useCallback(
    async (values: FieldFormState, kind: FieldKind): Promise<BucketType> => {
        return Promise.resolve(bucket as BucketType);
    //   if (!bucket) {
    //     throw new Error("No bucket available");
    //   }

    //   const fieldProperty = FIELD_REGISTRY[kind]?.buildCreationFormApiProperty(values);
    //   const {requiredField, primaryField} = values.configurationValues;
    //   const {title} = values.fieldValues;


    //   const modifiedBucket = {
    //     ...bucket,
    //     properties: {
    //       ...bucket.properties,
    //       [title]: fieldProperty
    //     },
    //     required: requiredField ? [...(bucketData?.bucket?.required || []), title] : bucketData?.bucket?.required,
    //     primary: primaryField ? title : bucket.primary
    //   };

    //   const result = await createBucketField(modifiedBucket as BucketType);
    //   if (!result.data) {
    //     throw new Error("Failed to create bucket field");
    //   }
    //   return result.data;
    },
    [bucket, createBucketField]
  );

  const forbiddenFieldNames = useMemo(() => {
    return bucket?.properties ? Object.keys(bucket.properties) : [];
  }, [bucket]);

  return (
    <div className={styles.tableContainer}>
      <Table
        columns={columns}
        data={data}
        saveToLocalStorage={{ id: `bucket-table-${bucket._id}`, save: true }}
        fixedColumns={[]}
        noResizeableColumns={[]}
        tableClassName={styles.table}
        headerClassName={styles.header}
        columnClassName={styles.column}
        cellClassName={styles.cell}
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

    </div>
  );
};

export default BucketTableNew;