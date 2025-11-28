import React, { useCallback, useEffect, useMemo, useState } from "react";
import {FlexElement, Icon, Table, type TableColumn, Button, Popover, type IconName } from "oziko-ui-kit";
import type { BucketSchema, BucketDataRow, BucketProperty } from "./types";
import { EditableCell } from "./EditableCell";
import styles from "./BucketTableNew.module.scss";
import type {FieldFormState} from "../../../domain/fields/types";
import type {BucketType} from "../../../store/api/bucketApi";
import { FieldKind } from "../../../domain/fields/types";
import { useCreateBucketFieldMutation, useDeleteBucketFieldMutation } from "../../../store/api/bucketApi";
import BucketFieldPopup from "../../molecules/bucket-field-popup/BucketFieldPopup";
import { FIELD_REGISTRY } from "../../../domain/fields/registry";
import ColumnActionsMenu from "../../molecules/column-actions-menu/ColumnActionsMenu";
import Confirmation from "../../molecules/confirmation/Confirmation";
import useLocalStorage from "../../../hooks/useLocalStorage";
interface BucketTableNewProps {
  bucket: BucketSchema;
  data: BucketDataRow[];
  onDataChange?: (rowId: string, propertyKey: string, newValue: any) => void;
}


function moveElement<T>(arr: T[], direction: "left" | "right", target: T): T[] {
  const index = arr.indexOf(target);
  if (index === -1) return arr;

  if (direction === "left" && index > 0) {
    const newArr = [...arr];
    [newArr[index - 1], newArr[index]] = [newArr[index], newArr[index - 1]];
    return newArr;
  }

  if (direction === "right" && index < arr.length - 1) {
    const newArr = [...arr];
    [newArr[index], newArr[index + 1]] = [newArr[index + 1], newArr[index]];
    return newArr;
  }

  return arr;
}

interface ColumnHeaderProps {
  title?: string;
  icon?: IconName;
  showDropdownIcon?: boolean;
  fieldKey?: string;
  onEdit?: () => void;
  onMoveRight?: (fieldKey: string) => void;
  onMoveLeft?: (fieldKey: string) => void;
  onSortAsc?: (fieldKey: string) => void;
  onSortDesc?: (fieldKey: string) => void;
  onDelete?: () => Promise<void | string>;
}

const ColumnHeader = ({
  title,
  icon,
  showDropdownIcon,
  fieldKey,
  onEdit,
  onMoveRight,
  onMoveLeft,
  onSortAsc,
  onSortDesc,
  onDelete
}: ColumnHeaderProps) => {
  const [fieldDeletionError, setFieldDeletionError] = useState<string | undefined>(undefined);
  const [isFieldDeletionLoading, setIsFieldDeletionLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const handleClose = () => {
    setIsOpen(false);
    setFieldDeletionError(undefined);
  };
  const handleOpen = () => setIsOpen(true);

  const [isConfirmationOpen, setIsConfirmationOpen] = useState(false);
  const openConfirmation = useCallback(() => setIsConfirmationOpen(true), []);
  const closeConfirmation = useCallback(() => {
    setIsConfirmationOpen(false);
    setFieldDeletionError(undefined);
    handleClose();
  }, []);

  const confirmDelete = useCallback(() => {
    setFieldDeletionError(undefined);
    setIsFieldDeletionLoading(true);
    onDelete?.().then(result => {
      setIsFieldDeletionLoading(false);
      if (typeof result === "string") {
        setFieldDeletionError(result);
        return;
      }
      closeConfirmation();
    });
  }, [onDelete]);

  const handleMoveRight = useCallback(() => {
    if (fieldKey) onMoveRight?.(fieldKey);
    handleClose();
  }, [onMoveRight, fieldKey]);

  const handleMoveLeft = useCallback(() => {
    if (fieldKey) onMoveLeft?.(fieldKey);
    handleClose();
  }, [onMoveLeft, fieldKey]);

  const handleSortAsc = useCallback(() => {
    if (fieldKey) onSortAsc?.(fieldKey);
    handleClose();
  }, [onSortAsc, fieldKey]);

  const handleSortDesc = useCallback(() => {
    if (fieldKey) onSortDesc?.(fieldKey);
    handleClose();
  }, [onSortDesc, fieldKey]);

  return (
    <>
      <div className={styles.columnHeaderWrapper}>
        <div className={styles.columnHeaderText}>
          {icon && <Icon name={icon} size={16} className={styles.headerIcon} />}
          <span>{title || "\u00A0"}</span>
        </div>
        {showDropdownIcon && (
          <Popover
            open={isOpen}
            onClose={handleClose}
            content={
              <ColumnActionsMenu
                onEdit={onEdit}
                onMoveRight={onMoveRight ? handleMoveRight : undefined}
                onMoveLeft={onMoveLeft ? handleMoveLeft : undefined}
                onSortAsc={handleSortAsc}
                onSortDesc={handleSortDesc}
                onDelete={onDelete ? openConfirmation : undefined}
              />
            }
            contentProps={{
              className: styles.popover
            }}
            placement="bottom"
          >
            <Button variant="icon" onClick={handleOpen}>
              <Icon name="chevronDown" size={16} />
            </Button>
          </Popover>
        )}
      </div>
      {isConfirmationOpen && (
        <Confirmation
          title="DELETE FIELD"
          description={
            <>
              <span>
                This action will remove the field from bucket entries. Please confirm this action to
                continue
              </span>
              <span>
                Please type <strong>agree</strong> to confirm deletion.
              </span>
            </>
          }
          inputPlaceholder="Type Here"
          confirmLabel={
            <>
              <Icon name="delete" />
              Delete
            </>
          }
          cancelLabel={
            <>
              <Icon name="close" />
              Cancel
            </>
          }
          showInput
          confirmCondition={val => val === "agree"}
          onConfirm={confirmDelete}
          onCancel={closeConfirmation}
          error={fieldDeletionError}
          loading={isFieldDeletionLoading}
        />
      )}
    </>
  );
};


const BucketTable: React.FC<BucketTableNewProps> = ({ 
  bucket, 
  data,
  onDataChange 
}) => {

  const [createBucketField] = useCreateBucketFieldMutation();
  const [deleteBucketField] = useDeleteBucketFieldMutation();

  const [fieldsOrder, setFieldsOrder] = useLocalStorage<string[]>(
    `${bucket?._id}-fields-order`,
    bucket?.properties ? Object.keys(bucket.properties) : []
  );
  const tableKey = useMemo(
    () => `${bucket?._id ?? "bucket"}-${fieldsOrder.join(",")}`,
    [bucket?._id, fieldsOrder]
  );

  const [sortMeta, setSortMeta] = useLocalStorage<{
    field: string;
    direction: "asc" | "desc";
  } | null>(`${bucket?._id}-sort-meta`, null);

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

      const bucketType = bucket as unknown as BucketType;

      const modifiedBucket: BucketType = {
        ...bucketType,
        properties: {
          ...bucket.properties,
          [title]: fieldProperty
        },
        required: requiredField ? [...(bucketType.required || []), title] : bucketType.required,
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

  const getPropertyIcon = useCallback((type: string) => {
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

  const handleValueChange = useCallback((propertyKey: string, rowId: string, newValue: any) => {
    onDataChange?.(rowId, propertyKey, newValue);
  }, [onDataChange]);

  const handleDeleteField = useCallback(
    async (fieldKey: string) => {
      if (!bucket) {
        console.error("Bucket not found");
        return "Bucket not found";
      }

      try {
        await deleteBucketField({ 
          bucketId: bucket._id, 
          fieldKey, 
          bucket: bucket as unknown as BucketType 
        }).unwrap();
      } catch (error) {
        console.error("Error deleting bucket field:", error);
        return "Error deleting field";
      }
    },
    [bucket, deleteBucketField]
  );

  const onMoveLeft = useCallback(
    (fieldTitle: string) => {
      const oldIndex = fieldsOrder.indexOf(fieldTitle);
      const newOrder = moveElement(fieldsOrder, "left", fieldsOrder[oldIndex]);
      setFieldsOrder(newOrder);
    },
    [fieldsOrder, setFieldsOrder]
  );

  const onMoveRight = useCallback(
    (fieldTitle: string) => {
      const oldIndex = fieldsOrder.indexOf(fieldTitle);
      const newOrder = moveElement(fieldsOrder, "right", fieldsOrder[oldIndex]);
      setFieldsOrder(newOrder);
    },
    [fieldsOrder, setFieldsOrder]
  );

  const onSortAsc = useCallback(
    (fieldTitle: string) => {
      setSortMeta({field: fieldTitle, direction: "asc"});
    },
    [setSortMeta]
  );

  const onSortDesc = useCallback(
    (fieldTitle: string) => {
      setSortMeta({field: fieldTitle, direction: "desc"});
    },
    [setSortMeta]
  );

  useEffect(() => {
    if (!bucket?.properties) return;
    
    const propertyKeys = Object.keys(bucket.properties);
    
    if (fieldsOrder.length === 0) {
      setFieldsOrder(propertyKeys);
      return;
    }
    
    const newKeys = propertyKeys.filter(key => !fieldsOrder.includes(key));
    
    const removedKeys = fieldsOrder.filter(key => !propertyKeys.includes(key));
    
    if (newKeys.length > 0 || removedKeys.length > 0) {
      const validKeys = fieldsOrder.filter(key => propertyKeys.includes(key));
      setFieldsOrder([...validKeys, ...newKeys]);
    }

  }, [bucket?.properties, bucket?._id]);

  const columns = useMemo((): TableColumn<BucketDataRow>[] => {
    if (!bucket?.properties) return [];

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


    const propertyKeys = Object.keys(bucket.properties);

    // Create ordered property entries
    const orderedKeys = fieldsOrder.filter(key => propertyKeys.includes(key));
    const newKeys = propertyKeys.filter(key => !fieldsOrder.includes(key));
    const finalOrderedKeys = [...orderedKeys, ...newKeys];

    const propertyColumns = finalOrderedKeys.map((key, index) => {
      const property: BucketProperty = bucket.properties[key];
      const icon = getPropertyIcon(property.type);
      const isPrimaryField = bucket.primary === key;
      
      const moveRightAllowed = index < finalOrderedKeys.length - 1;
      const moveLeftAllowed = index > 0;

      return {
        key,
        header: (
          <ColumnHeader
            title={property.title || key}
            icon={icon}
            showDropdownIcon={true}
            fieldKey={key}
            onMoveRight={moveRightAllowed ? onMoveRight : undefined}
            onMoveLeft={moveLeftAllowed ? onMoveLeft : undefined}
            onSortAsc={onSortAsc}
            onSortDesc={onSortDesc}
            onDelete={isPrimaryField ? undefined : () => handleDeleteField(key)}
          />
        ),
        width: "200px",
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

    return [...systemColumns, ...propertyColumns];
  }, [
    bucket, 
    fieldsOrder, 
    setFieldsOrder, 
    handleValueChange, 
    getPropertyIcon,
    onMoveLeft,
    onMoveRight,
    onSortAsc,
    onSortDesc,
    handleDeleteField
  ]);

  const sortedData = useMemo(() => {
    const currentData = data ?? [];
    if (!sortMeta || currentData.length === 0) return currentData;

    return [...currentData].sort((a, b) => {
      const aValue = a[sortMeta.field];
      const bValue = b[sortMeta.field];

      if (aValue == null && bValue == null) return 0;
      if (aValue == null) return 1;
      if (bValue == null) return -1;

      let comparison = 0;
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        comparison = aValue.localeCompare(bValue);
      } else if (typeof aValue === 'number' && typeof bValue === 'number') {
        comparison = aValue - bValue;
      } else if (aValue instanceof Date && bValue instanceof Date) {
        comparison = aValue.getTime() - bValue.getTime();
      } else {
        comparison = String(aValue).localeCompare(String(bValue));
      }

      return sortMeta.direction === 'asc' ? comparison : -comparison;
    });
  }, [data, sortMeta]);

  if (!bucket?.properties) {
    return (
      <div className={styles.emptyState}>
        <p>No bucket schema available</p>
      </div>
    );
  }


  return (
<>
<div className={styles.tableContainer}>
      <div className={styles.tableWrapper}>
        <Table
          key={tableKey}
          columns={columns}
          data={sortedData}
          saveToLocalStorage={{ id: `bucket-table-${bucket._id}`, save: true }}
          fixedColumns={['_id']}
          noResizeableColumns={['_id']}
          tableClassName={styles.table}
          headerClassName={styles.header}
          columnClassName={styles.column}
          cellClassName={styles.cell}
        />
      </div>
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
     {!sortedData.length && <div className={styles.noDataText}>
      <p>No data available</p>
    </div>}
</>
  );
};

export default BucketTable;