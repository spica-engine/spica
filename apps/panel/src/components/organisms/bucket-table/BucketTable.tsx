import {Button, Checkbox, Icon, Popover, type IconName} from "oziko-ui-kit";
import Table from "../table/Table";
import styles from "./BucketTable.module.scss";
import {memo, useCallback, useMemo, type RefObject} from "react";
import Loader from "../../../components/atoms/loader/Loader";
import BucketFieldPopup from "../../molecules/bucket-field-popup/BucketFieldPopup";
import {useGetBucketsQuery, useGetBucketDataQuery, useCreateBucketFieldMutation, type BucketType} from "../../../store/api/bucketApi";
import {FieldKind, FIELD_REGISTRY} from "../../../domain/fields";
import {BucketFieldPopupsProvider} from "../../molecules/bucket-field-popup/BucketFieldPopupsContext";
import ColumnActionsMenu from "../../molecules/column-actions-menu/ColumnActionsMenu";
import type {FieldFormState} from "../../../domain/fields/types";
import type { Property } from "src/store/api/bucketApi";

export type ColumnType = {
  id: string;
  header: any;
  key: string;
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
};

type ColumnHeaderProps = {
  title?: string;
  icon?: IconName;
  showDropdownIcon?: boolean;
  onEdit?: () => void;
  onMoveRight?: () => void;
  onMoveLeft?: () => void;
  onSortAsc?: () => void;
  onSortDesc?: () => void;
  onDelete?: () => void;
};

type ColumnMeta = {
  type?: FieldKind;
  deletable?: boolean;
  id: string;
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
  return (
    <>
      <div className={styles.columnHeaderText}>
        {icon && <Icon name={icon} size="sm" className={styles.headerIcon} />}
        <span>{title || "\u00A0"}</span>
      </div>
      {showDropdownIcon && (
        <Popover
          content={
            <ColumnActionsMenu
              onEdit={onEdit}
              onMoveRight={onMoveRight}
              onMoveLeft={onMoveLeft}
              onSortAsc={onSortAsc}
              onSortDesc={onSortDesc}
              onDelete={onDelete}
            />
          }
          contentProps={{
            className: styles.popover
          }}
          placement="topStart"
        >
          <Button variant="icon">
            <Icon name="chevronDown" size="lg" />
          </Button>
        </Popover>
      )}
    </>
  );
};

const NewFieldHeader = memo(({bucketId}: {bucketId: string}) => {
  const {data: buckets = []} = useGetBucketsQuery();
  const [createBucketField] = useCreateBucketFieldMutation();

  const bucket = useMemo(
    () => buckets.find(i => i._id === bucketId),
    [buckets, bucketId]
  );

  const handleSaveAndClose = useCallback(
    async (values: FieldFormState, kind: FieldKind): Promise<BucketType> => {
      if (!bucket) {
        throw new Error('No bucket available');
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
        required: requiredField 
          ? [...(bucket.required || []), title]
          : bucket.required,
        // Set as primary if primaryField is true
        primary: primaryField ? title : bucket.primary
      };

      const result = await createBucketField(modifiedBucket);
      if (!result.data) {
        throw new Error('Failed to create bucket field');
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

function getDefaultColumns(bucketId: string): ColumnType[] {
  return [
    {
      id: "0",
      header: <ColumnHeader />,
      key: "select",
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
      width: "125px",
      headerClassName: `${styles.columnHeader} ${styles.newFieldHeader}`,
      cellClassName: `${styles.newFieldCell} ${styles.cell}`,
      resizable: false,
      fixed: true,
      selectable: false
    }
  ];
}

// TODO: Refactor this function to render more appropriate UI elements for each field type.
// Many field types are currently using the generic `renderDefault()`.
function renderCell(cellData: any, type?: FieldKind, deletable?: boolean) {
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
  if (type === FieldKind.Boolean) return <Checkbox className={styles.checkbox} />;
  if (type) {
    const formatted = FIELD_REGISTRY[type]?.getFormattedValue?.(cellData);
    if (typeof formatted === "string" || typeof formatted === "number") return formatted as any;
  }
  return renderDefault();
}

function getFormattedColumns(columns: ColumnType[], bucketId: string): ColumnType[] {
  const defaultColumns = getDefaultColumns(bucketId);
  return [
    defaultColumns[0],
    ...columns.map((col, index) => ({
      ...col,
      header: (
        <ColumnHeader
          title={col.header}
          icon={col.type && COLUMN_ICONS[col.type]}
          showDropdownIcon={col.showDropdownIcon}
        />
      ),
      headerClassName: `${col.headerClassName || ""} ${styles.columnHeader}`,
      id: `${col.key}-${index}-s${bucketId}`,
      cellClassName: styles.cell
    })),
    defaultColumns[1]
  ];
}

function buildColumnMeta(columns: ColumnType[]): Record<string, ColumnMeta> {
  return Object.fromEntries(
    columns.map(col => [col.key, {type: col.type, deletable: col.deletable, id: col.id}])
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
          {id: `${meta.id}-${fullRow._id}`, value: renderCell(value, meta.type, meta.deletable)}
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
  tableRef
}: BucketTableProps) => {
  const formattedColumns = useMemo(
    () => getFormattedColumns(columns, bucketId),
    [columns, bucketId]
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
