import {
  Button,
  Checkbox,
  FlexElement,
  FluidContainer,
  Icon,
  Popover,
  type IconName
} from "oziko-ui-kit";
import Table from "../table/Table";
import styles from "./BucketTable.module.scss";
import {memo, useCallback, useMemo, type RefObject} from "react";
import Loader from "../../../components/atoms/loader/Loader";
import BucketFieldPopup from "../../molecules/bucket-field-popup/BucketFieldPopup";
import {useBucket} from "../../../contexts/BucketContext";
import {
  FieldKind,
  formatValue,
  FIELD_REGISTRY,
  buildCreationFormPropertiesFromForm,
} from "../../../domain/fields";
import {BucketFieldPopupsProvider} from "../../molecules/bucket-field-popup/BucketFieldPopupsContext";
import type {FormValues} from "../bucket-add-field/BucketAddFieldBusiness";
import ColumnActionsMenu from "../../molecules/column-actions-menu/ColumnActionsMenu";

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
  title?: string;
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
  onCellSave: (value: any, columnName: string, rowId: string) => Promise<any>;
  updateCellDataError?: string | null;
  requiredColumns?: string[];
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
            className: styles.popover,
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

const NewFieldHeader = memo(() => {
  const {buckets, bucketData, createBucketField} = useBucket();

  const bucket = useMemo(
    () => buckets.find(i => i._id === bucketData?.bucketId),
    [buckets, bucketData?.bucketId]
  );

  const handleSaveAndClose = useCallback(
    (values: FormValues) => {
      if (!bucket) return;

      const fieldProperty = buildCreationFormPropertiesFromForm(values as any);
      const {requiredField, primaryField} = values.configurationValues;
      const {title} = values.fieldValues;

      return createBucketField(
        bucket,
        fieldProperty as any,
        requiredField ? title : undefined,
        primaryField ? title : undefined
      );
    },
    [bucket, createBucketField]
  );

  return (
    <BucketFieldPopupsProvider>
      <BucketFieldPopup onSaveAndClose={handleSaveAndClose}>
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

const defaultColumns: ColumnType[] = [
  {
    id: "0",
    header: <ColumnHeader />,
    key: "select",
    type: FieldKind.Boolean,
    width: "41px",
    headerClassName: styles.columnHeader,
    cellClassName: `${styles.selectCell} ${styles.cell}`,
    resizable: false,
    fixed: true,
    selectable: false,
  },
  {
    id: "1",
    header: <NewFieldHeader />,
    key: "new field",
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
    const formatted = formatValue(type, cellData);
    if (typeof formatted === "string" || typeof formatted === "number") return formatted as any;
  }
  return renderDefault();
}

function getFormattedColumns(columns: ColumnType[], bucketId: string): ColumnType[] {
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
      id: `${col.key}-${index}-${bucketId}`,
      cellClassName: styles.cell,
      title: col.header,
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
          {id: `${meta.id}-${fullRow._id}`, value}
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
  onCellSave,
  updateCellDataError,
  requiredColumns = [],
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
      onCellSave={onCellSave}
      updateCellDataError={updateCellDataError}
      requiredColumns={requiredColumns}
    />
  );
};

export default memo(BucketTable);
