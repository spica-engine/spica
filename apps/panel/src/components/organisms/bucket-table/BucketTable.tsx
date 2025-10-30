import {Button, Checkbox, Icon, Popover, type IconName} from "oziko-ui-kit";
import Table from "../table/Table";
import styles from "./BucketTable.module.scss";
import {memo, useCallback, useMemo, useState, type RefObject} from "react";
import Loader from "../../../components/atoms/loader/Loader";
import BucketFieldPopup from "../../molecules/bucket-field-popup/BucketFieldPopup";
import {
  useGetBucketsQuery,
  useCreateBucketFieldMutation,
  useDeleteBucketFieldMutation,
  type BucketType
} from "../../../store/api/bucketApi";
import {FieldKind, FIELD_REGISTRY} from "../../../domain/fields";
import {BucketFieldPopupsProvider} from "../../molecules/bucket-field-popup/BucketFieldPopupsContext";
import {useEntrySelection} from "../../../contexts/EntrySelectionContext";
import ColumnActionsMenu from "../../molecules/column-actions-menu/ColumnActionsMenu";
import type {FieldFormState} from "../../../domain/fields/types";
import type {Property} from "src/services/bucketService";
import Confirmation from "../../../components/molecules/confirmation/Confirmation";
import useLocalStorage from "../../../hooks/useLocalStorage";
import StringField from "../../../bucket/BucketField";

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

type TypeColumnRole = "select" | "data" | "new-field";

export type ColumnType = {
  id: string;
  header: any;
  key: string;
  role?: TypeColumnRole;
  type?: FieldKind;
  width?: string;
  deletable?: boolean;
  headerClassName?: string;
  cellClassName?: string;
  showDropdownIcon?: boolean;
  resizable?: boolean;
  fixed?: boolean;
  selectable?: boolean;
  leftOffset?: number;
  fixedWidth?: boolean;
};

type BucketTableProps = {
  data: Record<string, any>[];
  columns: ColumnType[];
  onScrollEnd?: () => void;
  totalDataLength: number;
  maxHeight?: string | number;
  bucketId: string;
  loading: boolean;
  tableRef?: RefObject<HTMLElement | null>;
  primaryKey: string;
  onMoveLeft?: () => void;
  onMoveRight?: () => void;
};

type ColumnHeaderProps = {
  title?: string;
  icon?: IconName;
  showDropdownIcon?: boolean;
  onEdit?: () => void;
  onMoveRight?: (fieldTitle: string) => void;
  onMoveLeft?: (fieldTitle: string) => void;
  onSortAsc?: (fieldTitle: string) => void;
  onSortDesc?: (fieldTitle: string) => void;
  onDelete?: () => Promise<void | string>;
};

type ColumnMeta = {
  type?: FieldKind;
  deletable?: boolean;
  id: string;
  role?: TypeColumnRole;
};

const COLUMN_ICONS: Record<string, IconName> = Object.values(FieldKind).reduce(
  (acc, k) => {
    const def = FIELD_REGISTRY[k as FieldKind];
    if (def) acc[k] = def.display.icon as IconName;
    return acc;
  },
  {} as Record<string, IconName>
);

const ColumnHeader = ({
  title,
  icon,
  showDropdownIcon,
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
    onMoveRight?.(title!);
    handleClose();
  }, [onMoveRight]);
  const handleMoveLeft = useCallback(() => {
    onMoveLeft?.(title!);
    handleClose();
  }, [onMoveLeft]);
  const handleSortAsc = useCallback(() => {
    onSortAsc?.(title!);
    handleClose();
  }, [onSortAsc]);
  const handleSortDesc = useCallback(() => {
    onSortDesc?.(title!);
    handleClose();
  }, [onSortDesc]);

  return (
    <>
      <div className={styles.columnHeaderText}>
        {icon && <Icon name={icon} size="sm" className={styles.headerIcon} />}
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
            <Icon name="chevronDown" size="lg" />
          </Button>
        </Popover>
      )}
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

const SelectColumnHeader = ({
  visibleIds,
  dataExists
}: {
  visibleIds: string[];
  dataExists: boolean;
}) => {
  return dataExists ? (
    <div className={styles.selectColumnHeader}>
      <span>
        <SelectionCheckbox rowId="select-all" visibleIds={visibleIds} />
      </span>
    </div>
  ) : null;
};

function SelectionCheckbox({rowId, visibleIds}: {rowId: string; visibleIds?: string[]}) {
  const {selectEntry, deselectEntry, selectedEntries} = useEntrySelection();

  const isHeader = rowId === "select-all";
  const headerVisibleIds = isHeader ? visibleIds || [] : [];
  const selectedCount = isHeader
    ? headerVisibleIds.filter(id => selectedEntries.has(id)).length
    : undefined;
  const total = isHeader ? headerVisibleIds.length : undefined;

  const checked = isHeader ? total! > 0 && selectedCount === total : selectedEntries.has(rowId);
  const indeterminate = isHeader
    ? !!total && !!selectedCount && selectedCount! > 0 && selectedCount! < total!
    : false;

  const handleChange = () => {
    if (isHeader) {
      // If all are selected, deselect all visible; otherwise select all visible
      const shouldDeselect = checked;
      if (shouldDeselect) {
        headerVisibleIds.forEach(id => deselectEntry(id));
      } else {
        headerVisibleIds.forEach(id => selectEntry(id));
      }
    } else {
      if (!checked) selectEntry(rowId);
      else deselectEntry(rowId);
    }
  };

  return (
    <Checkbox
      className={styles.checkbox}
      checked={!!checked}
      indeterminate={!!indeterminate}
      onChange={handleChange}
    />
  );
}

const NewFieldHeader = memo(({bucketId}: {bucketId: string}) => {
  const {data: buckets = []} = useGetBucketsQuery();
  const [createBucketField] = useCreateBucketFieldMutation();

  const bucket = useMemo(() => buckets.find(i => i._id === bucketId), [buckets, bucketId]);

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

  const forbiddenFieldNames = useMemo(() => {
    if (!bucket) return [];
    return Object.keys(bucket.properties || {});
  }, [bucket]);

  return (
    <BucketFieldPopupsProvider>
      <BucketFieldPopup
        onSaveAndClose={handleSaveAndClose}
        forbiddenFieldNames={forbiddenFieldNames}
      >
        <Button
          variant="icon"
          className={`${styles.columnHeaderText} ${styles.newFieldColumnButton}`}
        >
          <Icon name={"plus"} size="sm" className={styles.newFieldHeaderIcon} />
          <span>New&nbsp;Field</span>
        </Button>
      </BucketFieldPopup>
    </BucketFieldPopupsProvider>
  );
});

const buildDefaultColumns = (
  visibleIds: string[],
  dataExists: boolean,
  bucketId: string
): ColumnType[] => [
  {
    id: "0",
    header: <SelectColumnHeader visibleIds={visibleIds} dataExists={dataExists} />,
    key: "select",
    role: "select",
    type: FieldKind.Boolean,
    width: "41px",
    fixedWidth: true,
    headerClassName: styles.columnHeader,
    cellClassName: `${styles.selectCell} ${styles.cell}`,
    resizable: false,
    fixed: true,
    selectable: false
  },
  {
    id: "1",
    header: <NewFieldHeader bucketId={bucketId} />,
    key: "new field",
    role: "new-field",
    width: "125px",
    headerClassName: `${styles.columnHeader} ${styles.newFieldHeader}`,
    cellClassName: `${styles.newFieldCell} ${styles.cell}`,
    resizable: false,
    fixed: true,
    selectable: false
  }
];

// TODO: Refactor this function to render more appropriate UI elements for each field type.
// Many field types are currently using the generic `renderDefault()`.
function renderCell(
  cellData: any,
  rowId: string,
  type?: FieldKind,
  deletable?: boolean,
  role?: TypeColumnRole
) {
  function renderDefault() {
    return (
      <div className={styles.defaultCell}>
        <div className={styles.defaultCellData}>{cellData}</div>
        {deletable && cellData && (
          <Button variant="icon">
            <Icon name="close" size="sm" />
          </Button>
        )}
      </div>
    );
  }
  if (type === FieldKind.Boolean) {
    switch (role) {
      case "select":
        return <SelectionCheckbox rowId={rowId} />;
      default:
        return <Checkbox className={styles.checkbox} checked={!!cellData} />;
    }
  }
  if (type) {
    const formatted = FIELD_REGISTRY[type]?.getSaveReadyValue?.(cellData);
    if (typeof formatted === "string" || typeof formatted === "number") return formatted as any;
    if (typeof formatted === "object") return JSON.stringify(formatted)
  }
  return renderDefault();
}

function getFormattedColumns(
  columns: ColumnType[],
  bucketId: string,
  handleDeleteField: (fieldKey: string) => Promise<void | string>,
  primaryKey: string,
  visibleIds: string[],
  dataExists: boolean,
  onMoveLeft?: (fieldTitle: string) => void,
  onMoveRight?: (fieldTitle: string) => void,
  onSortAsc?: (fieldTitle: string) => void,
  onSortDesc?: (fieldTitle: string) => void
): ColumnType[] {
  const defaultColumns = buildDefaultColumns(visibleIds, dataExists, bucketId);
  return [
    defaultColumns[0],
    ...columns.map((col, index) => {
      const handleDelete = () => handleDeleteField(col.key);
      const isIdField = index === 0; // in one of the pr's, the id and select fields are specified with their role attributes
      const isPrimaryField = col.key === primaryKey;
      const {header, type, showDropdownIcon} = col;
      const moveRightAllowed = index !== columns.length - 1 && index !== 0;
      const moveLeftAllowed = index > 1;
      const icon = COLUMN_ICONS[type as string];
      return {
        ...col,
        header: (
          <ColumnHeader
            title={header}
            icon={icon}
            showDropdownIcon={showDropdownIcon}
            onMoveRight={moveRightAllowed ? onMoveRight : undefined}
            onMoveLeft={moveLeftAllowed ? onMoveLeft : undefined}
            onSortAsc={onSortAsc}
            onSortDesc={onSortDesc}
            onEdit={isIdField ? undefined : () => {}}
            onDelete={isIdField || isPrimaryField ? undefined : handleDelete}
          />
        ),
        headerClassName: `${col.headerClassName || ""} ${styles.columnHeader}`,
        id: `${col.key}-${index}-s${bucketId}`,
        cellClassName: styles.cell
      };
    }),
    defaultColumns[1]
  ];
}

function buildColumnMeta(columns: ColumnType[]): Record<string, ColumnMeta> {
  return Object.fromEntries(
    columns.map(col => [
      col.key,
      {type: col.type, deletable: col.deletable, id: col.id, role: col.role}
    ])
  );
}
function formatDataRows(data: any[], columnMap: Record<string, ColumnMeta>) {
  const allKeys = Object.keys(columnMap);

  return data.map(row => {
    const fullRow: Record<string, any> = {
      select: "",
      "new field": ""
    };

    allKeys.forEach(key => {
      if (!(key in fullRow)) {
        fullRow[key] = row[key];
      }
    });

    return Object.fromEntries(
      Object.entries(fullRow).map(([key, value]) => {
        const meta = columnMap[key] || {};
        return [
          key,
          {
            id: `${meta.id}-${fullRow._id}`,
            value: renderCell(value, fullRow._id, meta.type, meta.deletable, meta.role)
          }
        ];
      })
    );
  });
}

const BucketTable = ({
  data,
  columns,
  onScrollEnd,
  totalDataLength,
  maxHeight,
  loading,
  bucketId,
  tableRef,
  primaryKey
}: BucketTableProps) => {
  const { data: buckets } = useGetBucketsQuery();
  const [deleteBucketField] = useDeleteBucketFieldMutation();

  const handleDeleteField = useCallback(
    async (fieldKey: string) => {
      const bucket = buckets?.find(b => b._id === bucketId);
      if (!bucket) {
        console.error("Bucket not found");
        return "Bucket not found";
      }

      try {
        await deleteBucketField({ bucketId, fieldKey, bucket }).unwrap();
      } catch (error) {
        console.error("Error deleting bucket field:", error);
        return "Error deleting field";
      }
    },
    [bucketId, buckets, deleteBucketField]
  );

  const [fieldsOrder, setFieldsOrder] = useLocalStorage<string[]>(`${bucketId}-fields-order`, [
    ...columns.slice(1).map(i => i.key)
  ]);

  const [sortMeta, setSortMeta] = useLocalStorage<{
    field: string;
    direction: "asc" | "desc";
  } | null>(`${bucketId}-sort-meta`, null);
  const onMoveLeft = useCallback(
    (fieldTitle: string) => {
      const oldIndex = fieldsOrder.indexOf(fieldTitle);
      const newOrder = moveElement(fieldsOrder, "left", fieldsOrder[oldIndex]);
      setFieldsOrder(newOrder);
    },
    [columns, bucketId]
  );

  const visibleIds = useMemo(
    () => (data?.map?.(r => r._id).filter(Boolean) as string[]) || [],
    [data]
  );
  const dataExists = data.length > 0;

  const onMoveRight = useCallback(
    (fieldTitle: string) => {
      const oldIndex = fieldsOrder.indexOf(fieldTitle);
      const newOrder = moveElement(fieldsOrder, "right", fieldsOrder[oldIndex]);
      setFieldsOrder(newOrder);
    },
    [columns, bucketId]
  );

  const onSortAsc = useCallback(
    (fieldTitle: string) => {
      setSortMeta({field: fieldTitle, direction: "asc"});
    },
    [bucketId]
  );

  const onSortDesc = useCallback(
    (fieldTitle: string) => {
      setSortMeta({field: fieldTitle, direction: "desc"});
    },
    [bucketId]
  );

  const formattedColumns = useMemo(
    () =>
      getFormattedColumns(
        columns,
        bucketId,
        handleDeleteField,
        primaryKey,
        visibleIds,
        dataExists,
        onMoveLeft,
        onMoveRight,
        onSortAsc,
        onSortDesc
      ),
    [
      columns,
      bucketId,
      handleDeleteField,
      primaryKey,
      visibleIds,
      dataExists,
      onMoveLeft,
      onMoveRight,
      onSortAsc,
      onSortDesc
    ]
  );
  const columnMap = useMemo(() => buildColumnMeta(formattedColumns), [formattedColumns]);
  const formattedData = useMemo(
    () => formatDataRows(data, columnMap),
    [data, columnMap, columnMap.length]
  );


  return loading ? (
    <Loader />
  ) : (
     <Table
      style={{maxHeight}}
      className={styles.table}
      columns={formattedColumns}
      data={formattedData}
      onScrollEnd={onScrollEnd}
      totalDataLength={totalDataLength}
      tableRef={tableRef}
    />
   
  );
};

export default memo(BucketTable);
