import React, { useMemo } from "react";
import { Table, type TableColumn } from "oziko-ui-kit";
import type { BucketSchema, BucketDataRow, BucketProperty } from "./types";
import { EditableCell } from "./EditableCell";
import styles from "./BucketTableNew.module.scss";

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
    console.log("Value changed:", { propertyKey, rowId, newValue });
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

  return (
    <div className={styles.container}>
      <Table
        columns={columns}
        data={data}
        saveToLocalStorage={{ id: `bucket-table-${bucket._id}`, save: true }}
        fixedColumns={[]}
        noResizeableColumns={[]}
        tableClassName={styles.bucketTable}
      />
    </div>
  );
};

export default BucketTableNew;