import React, { useCallback, useMemo } from "react";
import {FlexElement, Icon, Table, type TableColumn } from "oziko-ui-kit";
import type { BucketSchema, BucketDataRow, BucketProperty } from "./types";
import { EditableCell } from "./EditableCell";
import styles from "./BucketTableNew.module.scss";
import type {FieldFormState} from "../../../domain/fields/types";
import type {BucketType} from "../../../store/api/bucketApi";
import { FieldKind } from "../../../domain/fields/types";
import { useCreateBucketFieldMutation } from "../../../store/api/bucketApi";
import BucketFieldPopup from "../../molecules/bucket-field-popup/BucketFieldPopup";
import { FIELD_REGISTRY } from "../../../domain/fields/registry";
import type { Property } from "../../../services/bucketService";
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
  // All hooks must be called before any conditional returns
  const [createBucketField] = useCreateBucketFieldMutation();

  const forbiddenFieldNames = useMemo(() => {
    return bucket?.properties ? Object.keys(bucket.properties) : [];
  }, [bucket]);

  const handleSaveAndClose = useCallback(
    async (values: FieldFormState, kind: FieldKind): Promise<BucketType> => {
      if (!bucket) {
        throw new Error("No bucket available");
      }

      const fieldProperty = FIELD_REGISTRY[kind]?.buildCreationFormApiProperty(values);
      const {requiredField, primaryField} = values.configurationValues;
      const {title} = values.fieldValues;

      // Cast bucket to BucketType to access required array
      const bucketType = bucket as unknown as BucketType;

      // Build the modified bucket with new field
      const modifiedBucket: BucketType = {
        ...bucketType,
        properties: {
          ...bucket.properties,
          [title]: fieldProperty as Property
        },
        // Add to required array if requiredField is true
        required: requiredField ? [...(bucketType.required || []), title] : bucketType.required,
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

  /**
   * Get appropriate column width based on property type
   */
  const getColumnWidth = useCallback((type: string): string => {
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
  }, []);

  /**
   * Get icon for a property type from the field registry
   */
  const getPropertyIcon = useCallback((type: string) => {
    // Map property types to field kinds
    const typeToKindMap: Record<string, FieldKind> = {
      string: FieldKind.String,
      textarea: FieldKind.Textarea,
      number: FieldKind.Number,
      date: FieldKind.Date,
      relation: FieldKind.Relation,
      boolean: FieldKind.Boolean,
      array: FieldKind.Array,
      object: FieldKind.Object,
      location: FieldKind.Location,
      richtext: FieldKind.Richtext,
      color: FieldKind.Color,
    };

    const kind = typeToKindMap[type];
    return kind ? FIELD_REGISTRY[kind]?.display?.icon : undefined;
  }, []);

  /**
   * Handle value changes from cells
   */
  const handleValueChange = useCallback((propertyKey: string, rowId: string, newValue: any) => {
    onDataChange?.(rowId, propertyKey, newValue);
  }, [onDataChange]);

  /**
   * Generate table columns from bucket properties
   */
  const columns = useMemo((): TableColumn<BucketDataRow>[] => {
    if (!bucket?.properties) return [];

    // Add system columns that always exist but aren't in properties
    const systemColumns: TableColumn<BucketDataRow>[] = [
      {
        key: '_id',
        header: '_id',
        width: '200px',
        renderCell: (params: { row: BucketDataRow; isFocused: boolean }) => {
          return (
            <div className={styles.readonlyCell}>
              {params.row._id}
            </div>
          );
        },
      }
    ];

    const propertyEntries = Object.entries(bucket.properties);

    const propertyColumns = propertyEntries.map(([key, property]: [string, BucketProperty]) => {
      const icon = getPropertyIcon(property.type);
      
      return {
        key,
        header: (
          <FlexElement gap={8} alignment="leftCenter">
            {icon && <Icon name={icon} size={16} />}
            <span>{property.title || key}</span>
          </FlexElement>
        ),
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
      };
    });

    // Combine system columns with property columns
    return [...systemColumns, ...propertyColumns];
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
    <div className={styles.tableContainer}>
      <Table
        key={`${bucket._id}-${Object.keys(bucket.properties || {}).length}`}
        columns={columns}
        data={data}
        saveToLocalStorage={{ id: `bucket-table-${bucket._id}`, save: true }}
        fixedColumns={['_id']}
        noResizeableColumns={['_id']}
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