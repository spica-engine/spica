import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {FlexElement, Icon, Table, type TableColumn, Button, Popover, type IconName } from "oziko-ui-kit";
import {useEntrySelection} from "../../../hooks/useEntrySelection";
import type { BucketSchema, BucketDataRow, BucketProperty } from "./types";
import { cellRegistry } from "./cellRegistry";
import styles from "./BucketTable.module.scss";
import cellStyles from "./cells/Cells.module.scss";
import type {FieldFormState} from "../../../domain/fields/types";
import type {BucketType} from "../../../store/api/bucketApi";
import { FieldKind } from "../../../domain/fields/types";
import { useCreateBucketFieldMutation, useDeleteBucketFieldMutation } from "../../../store/api/bucketApi";
import BucketFieldPopup from "../../molecules/bucket-field-popup/BucketFieldPopup";
import AddFieldModal from "../add-field-modal/AddFieldModal";
import { FIELD_REGISTRY } from "../../../domain/fields/registry";
import { propertyToFieldFormState } from "../../../domain/fields/propertyToFormState";
import ColumnActionsMenu from "../../molecules/column-actions-menu/ColumnActionsMenu";
import Confirmation from "../../molecules/confirmation/Confirmation";
import useLocalStorage from "../../../hooks/useLocalStorage";
import type { TableRowClickParams } from "oziko-ui-kit";
import { CellSelectionProvider } from "./useCellSelection";

interface BucketTableNewProps {
  bucket: BucketSchema;
  data: BucketDataRow[];
  onDataChange?: (rowId: string, propertyKey: string, newValue: any) => void;
  onRowClick?: (params: TableRowClickParams<BucketDataRow>) => void;
  onExpandRow?: (row: BucketDataRow) => void;
  onNewEntry?: () => void;
  loading?: boolean;
  totalCount?: number;
  visibleColumns?: Record<string, boolean>;
  onSort?: (sort: Record<string, 1 | -1> | null) => void;
  onLoadMore?: () => void;
  hasMore?: boolean;
  isLoadingMore?: boolean;
}


type BucketIndex = {definition: Record<string, number | string>; options?: Record<string, any>};

/**
 * Recompute the bucket-level `indexes` array for a single field after a field
 * create/edit. The backend (BucketService.updateIndexes) turns each entry into a
 * real MongoDB index, so the "Unique Values" / "Indexed field in database"
 * toggles must be expressed here — they have no valid home on the property
 * itself (the bucket schema only allows `translate`/`history` in property
 * `options`).
 *
 * We only manage the single-field index the UI toggles control; any other
 * (e.g. compound) indexes are left untouched. The previous single-field index
 * for the field is dropped first, which also covers renames and disabling.
 * A unique index implies "indexed", so `unique` alone is enough to create one.
 */
function applyFieldIndex(
  indexes: BucketIndex[] | undefined,
  fieldName: string,
  opts: {index?: boolean; unique?: boolean},
  oldFieldName: string = fieldName
): BucketIndex[] {
  const isSingleFieldIndexOn = (idx: BucketIndex, field: string) => {
    const keys = Object.keys(idx?.definition ?? {});
    return keys.length === 1 && keys[0] === field;
  };

  const next = (indexes ?? []).filter(
    idx => !isSingleFieldIndexOn(idx, oldFieldName) && !isSingleFieldIndexOn(idx, fieldName)
  );

  const wantsUnique = !!opts.unique;
  const wantsIndex = wantsUnique || !!opts.index;

  if (wantsIndex) {
    next.push({
      definition: {[fieldName]: 1},
      ...(wantsUnique ? {options: {unique: true}} : {})
    });
  }

  return next;
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

  const handleEdit = useCallback(() => {
    onEdit?.();
    handleClose();
  }, [onEdit]);

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
                onEdit={onEdit ? handleEdit : undefined}
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
            <Button variant="icon" onClick={handleOpen} className={styles.dropdownIcon}>
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
  onNewEntry,
  bucket, 
  data,
  onDataChange,
  onRowClick,
  onExpandRow,
  loading = false,
  totalCount,
  visibleColumns,
  onSort,
  onLoadMore,
  hasMore = false,
  isLoadingMore = false
}) => {
  const {selectedEntries, selectEntry, deselectEntry, selectEntries, resetSelection} = useEntrySelection(bucket._id);

  const [createBucketField] = useCreateBucketFieldMutation();
  const [deleteBucketField] = useDeleteBucketFieldMutation();
  const tableContainerRef = useRef<HTMLDivElement>(null);

  // The oziko Table owns near-bottom detection on its internal `.tableArea`
  // scroll container and calls this when the user nears the end; guard against
  // re-firing while a page is already in flight or when the list is exhausted.
  const handleReachBottom = useCallback(() => {
    if (hasMore && !isLoadingMore) onLoadMore?.();
  }, [hasMore, isLoadingMore, onLoadMore]);

  // Switching buckets must start at the top: the oziko Table keeps its internal
  // `.tableArea` scroll position across data swaps, so reset both the wrapper and
  // its scrollable descendant on both axes after the new bucket renders.
  useEffect(() => {
    const reset = () => {
      const wrapper = tableContainerRef.current;
      if (!wrapper) return;
      wrapper.scrollTop = 0;
      wrapper.scrollLeft = 0;
      const scrollable = wrapper.querySelector<HTMLElement>('[class*="tableArea"]');
      if (scrollable) {
        scrollable.scrollTop = 0;
        scrollable.scrollLeft = 0;
      }
    };
    reset();
    const id = requestAnimationFrame(reset);
    return () => cancelAnimationFrame(id);
  }, [bucket._id]);

  const [editingField, setEditingField] = useState<{
    key: string;
    kind: FieldKind;
    formState: FieldFormState;
  } | null>(null);

  const [fieldsOrder, setFieldsOrder] = useLocalStorage<string[]>(
    `${bucket?._id}-fields-order`,
    bucket?.properties ? Object.keys(bucket.properties) : []
  );

  const forbiddenFieldNames = useMemo(() => {
    return bucket?.properties ? Object.keys(bucket.properties) : [];
  }, [bucket]);

  const editForbiddenFieldNames = useMemo(() => {
    if (!editingField) return forbiddenFieldNames;
    return forbiddenFieldNames.filter(n => n !== editingField.key);
  }, [forbiddenFieldNames, editingField]);

  const handleSaveAndClose = useCallback(
    async (values: FieldFormState, kind: FieldKind): Promise<BucketType> => {
      if (!bucket) {
        throw new Error("No bucket available");
      }

      const fieldProperty = FIELD_REGISTRY[kind]?.buildCreationFormApiProperty(values);
      const {requiredField, primaryField, uniqueValues, index} =
        values.configurationValues as Record<string, boolean | undefined>;
      const {title} = values.fieldValues;

      const bucketType = bucket as unknown as BucketType;

      const modifiedBucket: BucketType = {
        ...bucketType,
        properties: {
          ...bucket.properties,
          [title]: fieldProperty
        },
        required: requiredField ? [...(bucketType.required || []), title] : bucketType.required,
        primary: primaryField ? title : bucket.primary,
        indexes: applyFieldIndex((bucketType as any).indexes, title, {index, unique: uniqueValues})
      } as BucketType;

      const result = await createBucketField(modifiedBucket);
      if (!result.data) {
        throw new Error("Failed to create bucket field");
      }
      
      return result.data;
    },
    [bucket, createBucketField]
  );

  const handleOpenEditField = useCallback(
    (key: string, property: BucketProperty) => {
      const formState = propertyToFieldFormState(key, property, bucket as unknown as BucketSchema);
      setEditingField({key, kind: formState.type, formState});
    },
    [bucket]
  );

  const handleEditSaveAndClose = useCallback(
    async (values: FieldFormState, kind: FieldKind): Promise<BucketType> => {
      if (!bucket || !editingField) throw new Error("No bucket or editing field");

      const fieldProperty = FIELD_REGISTRY[kind]?.buildCreationFormApiProperty(values);
      const {requiredField, primaryField, uniqueValues, index} =
        values.configurationValues as Record<string, boolean | undefined>;
      const newTitle = values.fieldValues.title;
      const oldKey = editingField.key;

      const bucketType = bucket as unknown as BucketType;
      const {[oldKey]: _removed, ...otherProperties} = (bucketType.properties ?? {}) as Record<string, any>;

      const prevRequired = bucketType.required ?? [];
      const required = [
        ...prevRequired.filter((r: string) => r !== oldKey),
        ...(requiredField ? [newTitle] : [])
      ];

      let primary = bucketType.primary === oldKey ? undefined : bucketType.primary;
      if (primaryField) primary = newTitle;

      const indexes = applyFieldIndex(
        (bucketType as any).indexes,
        newTitle,
        {index, unique: uniqueValues},
        oldKey
      );

      const modifiedBucket: BucketType = {
        ...bucketType,
        properties: {...otherProperties, [newTitle]: fieldProperty},
        required: required.length ? required : undefined,
        primary,
        indexes
      } as BucketType;

      const result = await createBucketField(modifiedBucket);
      if (!result.data) throw new Error("Failed to update bucket field");
      setEditingField(null);
      return result.data;
    },
    [bucket, editingField, createBucketField]
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
      onSort?.({[fieldTitle]: 1});
    },
    [onSort]
  );

  const onSortDesc = useCallback(
    (fieldTitle: string) => {
      onSort?.({[fieldTitle]: -1});
    },
    [onSort]
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


  const renderIdCell = useCallback((params: { row: BucketDataRow; isFocused: boolean }) => {
    return (
      <div className={styles.readonlyCell}>
        {params.row._id}
      </div>
    );
  }, []);


  const createDeleteHandler = useCallback((fieldKey: string, isPrimaryField: boolean) => {
    if (isPrimaryField) return undefined;
    return () => handleDeleteField(fieldKey);
  }, [handleDeleteField]);

  const createPropertyRenderCell = useCallback((
    key: string,
    property: BucketProperty
  ) => {
    const cellConfig = cellRegistry.get(property.type);
    const CellComponent = cellConfig.component;

    return (params: { row: BucketDataRow; isFocused: boolean }) => {
      const value = params.row[key];

      return (
        <CellComponent
          value={structuredClone(value)}
          propertyKey={key}
          property={property}
          rowId={params.row._id}
          onChange={(newValue) => handleValueChange(key, params.row._id, newValue)}
        />
      );
    };
  }, [handleValueChange]);

  const createPropertyColumn = useCallback((
    key: string,
    property: BucketProperty,
    index: number,
    totalKeys: number
  ): TableColumn<BucketDataRow> => {
    const icon = getPropertyIcon(property.type);
    const isPrimaryField = bucket.primary === key;
    const moveRightAllowed = index < totalKeys - 1;
    const moveLeftAllowed = index > 0;

    return {
      key,
      header: (
        <ColumnHeader
          title={property.title || key}
          icon={icon}
          showDropdownIcon={true}
          fieldKey={key}
          onEdit={() => handleOpenEditField(key, property)}
          onMoveRight={moveRightAllowed ? onMoveRight : undefined}
          onMoveLeft={moveLeftAllowed ? onMoveLeft : undefined}
          onSortAsc={onSortAsc}
          onSortDesc={onSortDesc}
          onDelete={createDeleteHandler(key, isPrimaryField)}
        />
      ),
      width: "150px",
      minWidth: "150px",
      renderCell: createPropertyRenderCell(key, property),
    };
  }, [
    bucket.primary,
    getPropertyIcon,
    onMoveRight,
    onMoveLeft,
    onSortAsc,
    onSortDesc,
    createDeleteHandler,
    createPropertyRenderCell,
    handleOpenEditField
  ]);

  const renderExpandCell = useCallback((params: {row: BucketDataRow; isFocused: boolean}) => {
    return (
      <div className={cellStyles.expandCell}>
        <button
          type="button"
          className={cellStyles.expandButton}
          onClick={e => {
            e.stopPropagation();
            onExpandRow?.(params.row);
          }}
        >
          <Icon name="pencil" size={14} />
        </button>
      </div>
    );
  }, [onExpandRow]);

  const renderCheckboxCell = useCallback((params: {row: BucketDataRow; isFocused: boolean}) => {
    const isChecked = selectedEntries.has(params.row._id);
    return (
      <div className={styles.checkboxCell}>
        <input
          type="checkbox"
          className={styles.rowCheckbox}
          checked={isChecked}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => {
            e.stopPropagation();
            if (isChecked) {
              deselectEntry(params.row._id);
            } else {
              selectEntry(params.row._id);
            }
          }}
        />
      </div>
    );
  }, [selectedEntries, selectEntry, deselectEntry]);

  // Hoisted so the CellSelectionProvider and the rendered columns share one
  // ordered source; divergence would desync keyboard nav from the visible grid.
  const visibleOrderedKeys = useMemo((): string[] => {
    if (!bucket?.properties) return [];

    const propertyKeys = Object.keys(bucket.properties);
    const orderedKeys = fieldsOrder.filter(key => propertyKeys.includes(key));
    const newKeys = propertyKeys.filter(key => !fieldsOrder.includes(key));
    const finalOrderedKeys = [...orderedKeys, ...newKeys];

    return visibleColumns
      ? finalOrderedKeys.filter(key => visibleColumns[key] !== false)
      : finalOrderedKeys;
  }, [bucket?.properties, fieldsOrder, visibleColumns]);

  const orderedRowIds = useMemo(() => data.map(r => r._id), [data]);

  const propertyColumns = useMemo((): TableColumn<BucketDataRow>[] => {
    if (!bucket?.properties) return [];

    const idColumn: TableColumn<BucketDataRow> = {
      key: '_id',
      header: '_id',
      width: '250px',
      minWidth: '250px',
      renderCell: renderIdCell,
    };

    const propCols = visibleOrderedKeys.map((key, index) => {
      const property: BucketProperty = bucket.properties[key];
      return createPropertyColumn(key, property, index, visibleOrderedKeys.length);
    });

    return [idColumn, ...propCols];
  }, [
    bucket?.properties,
    visibleOrderedKeys,
    renderIdCell,
    createPropertyColumn
  ]);

  const columns = useMemo((): TableColumn<BucketDataRow>[] => {
    const hasData = data.length > 0;
    const allSelected = hasData && data.every(row => selectedEntries.has(row._id));
    const someSelected = hasData && !allSelected && data.some(row => selectedEntries.has(row._id));

    const checkboxColumn: TableColumn<BucketDataRow> = {
      key: 'checkbox',
      header: (
        <div className={styles.checkboxCell}>
          <input
            type="checkbox"
            className={styles.rowCheckbox}
            checked={allSelected}
            disabled={!hasData}
            ref={el => { if (el) el.indeterminate = someSelected; }}
            onChange={() => {
              if (allSelected || someSelected) {
                resetSelection();
              } else {
                selectEntries(data.map(row => row._id));
              }
            }}
          />
        </div>
      ),
      width: '40px',
      minWidth: '40px',
      renderCell: renderCheckboxCell,
    };

    const expandColumn: TableColumn<BucketDataRow> = {
      key: '__expand__',
      header: '',
      width: '40px',
      minWidth: '40px',
      renderCell: renderExpandCell,
    };

    return [checkboxColumn, expandColumn, ...propertyColumns];
  }, [data, selectedEntries, selectEntries, resetSelection, propertyColumns, renderCheckboxCell, renderExpandCell]);


  if (!bucket?.properties) {
    return (
      <div className={styles.emptyState}>
        <p>No bucket schema available</p>
      </div>
    );
  }


  return (
<>
<div ref={tableContainerRef} className={styles.tableContainer}>
      <CellSelectionProvider
        editable={!!onDataChange}
        orderedColumnKeys={visibleOrderedKeys}
        orderedRowIds={orderedRowIds}
        containerRef={tableContainerRef}
      >
      <Table
        columns={columns}
        data={data}
        cellClassName={styles.bucketCell}
        saveToLocalStorage={{ id: `bucket-table-${bucket._id}`, save: true }}
        fixedColumns={['checkbox', '__expand__', '_id']}
        noResizeableColumns={['checkbox', '__expand__']}
        loading={loading}
        skeletonRowCount={10}
        virtualizeRowHeight={36}
        onReachBottom={handleReachBottom}
        reachBottomOffset={300}
        footer={
          isLoadingMore ? (
            <div className={styles.loadingMore}>
              <Icon name="refresh" size={14} className={styles.spinner} />
              <span>Loading more…</span>
            </div>
          ) : undefined
        }
        onRowClick={onRowClick}
        emptyState={onNewEntry ? {
          title: "This bucket is empty",
          description: "No entries yet. Add one manually or import in bulk via CSV.",
          actions: (
            <Button variant="solid" onClick={onNewEntry}>
              <Icon name="plus" size={14} />
              New Entry
            </Button>
          ),
        } : undefined}
      />
      </CellSelectionProvider>
      <div className={`${styles.newFieldContainer} ${!loading && data.length === 0 && onNewEntry ? styles.newFieldContainerEmpty : ""}`}>
        <BucketFieldPopup
          onSaveAndClose={handleSaveAndClose}
          forbiddenFieldNames={forbiddenFieldNames}
          bucketProperties={bucket.properties as unknown as BucketType["properties"]}
        >
          {({onOpen}) => (
            <FlexElement className={styles.newFieldHeader} dimensionY={34} dimensionX="fill" onClick={onOpen}>
              <Icon name="plus" size={16} />
              <span>New Field</span>
            </FlexElement>
          )}
        </BucketFieldPopup>
      </div>

    </div>
    <div className={styles.tableStatusBar}>
      <span className={styles.statusCount}>
        Showing {data.length} of {totalCount ?? data.length}
      </span>
      {selectedEntries.size > 0 && (
        <>
          <span className={styles.statusSeparator} aria-hidden="true">·</span>
          <span className={styles.statusSelected}>{selectedEntries.size} selected</span>
        </>
      )}
    </div>
    {editingField && (
      <AddFieldModal
        isOpen={true}
        onClose={() => setEditingField(null)}
        initialFieldKind={editingField.kind}
        initialValues={editingField.formState}
        onSaveAndClose={handleEditSaveAndClose}
        forbiddenFieldNames={editForbiddenFieldNames}
        bucketProperties={bucket.properties as unknown as BucketType["properties"]}
      />
    )}
</>
  );
};

export default BucketTable;