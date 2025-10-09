import {Button, Checkbox, Icon, Popover, type IconName} from "oziko-ui-kit";
import Table from "../table/Table";
import styles from "./BucketTable.module.scss";
import {memo, useCallback, useMemo, type RefObject} from "react";
import Loader from "../../../components/atoms/loader/Loader";
import BucketFieldPopup from "../../molecules/bucket-field-popup/BucketFieldPopup";
import {useBucket} from "../../../contexts/BucketContext";
import {
  FieldKind,
  FIELD_REGISTRY,
} from "../../../domain/fields";
import {BucketFieldPopupsProvider} from "../../molecules/bucket-field-popup/BucketFieldPopupsContext";
import ColumnActionsMenu from "../../molecules/column-actions-menu/ColumnActionsMenu";
import type {FieldFormState} from "../../../domain/fields/types";
import type { Property } from "src/services/bucketService";

type BaseColumn = {
  id: string;
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
  title?: string;
};

export type RawColumn = BaseColumn & {
  header: string;
};

export type FormattedColumn = BaseColumn & {
  header: string | React.ReactNode;
};

type BucketTableProps = {
  data: Record<string, any>[];
  columns: RawColumn[];
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
  title?: string | React.ReactNode;
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

const NewFieldHeader = memo(() => {
  const {buckets, bucketData, createBucketField} = useBucket();

  const bucket = useMemo(
    () => buckets.find(i => i._id === bucketData?.bucketId),
    [buckets, bucketData?.bucketId]
  );

  const handleSaveAndClose = useCallback(
    (values: FieldFormState, kind: FieldKind) => {
      if (!bucket) return;

      const fieldProperty = FIELD_REGISTRY[kind]?.buildCreationFormApiProperty(values);
      const {requiredField, primaryField} = values.configurationValues;
      const {title} = values.fieldValues;

      return createBucketField(
        bucket,
        fieldProperty as Property,
        requiredField ? title : undefined,
        primaryField ? title : undefined
      );
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

const defaultColumns: FormattedColumn[] = [
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

function getFormattedColumns(columns: FormattedColumn[], bucketId: string): FormattedColumn[] {
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
      title: col.header
    })) as FormattedColumn[],
    defaultColumns[1]
  ];
}

function buildColumnMeta(columns: FormattedColumn[]): Record<string, ColumnMeta> {
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
        return [key, {id: `${meta.id}-${fullRow._id}`, value}];
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
  requiredColumns = []
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
      requiredColumns={requiredColumns}
    />
  );
};

export default memo(BucketTable);
