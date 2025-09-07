import {Button, Icon, type IconName} from "oziko-ui-kit";
import Table, { type FieldType } from "../table/Table";
import styles from "./BucketTable.module.scss";
import {memo, useMemo, type RefObject} from "react";
import Loader from "../../../components/atoms/loader/Loader";


export type ColumnType = {
  id: string;
  header: any;
  key: string;
  type?: FieldType;
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
  tableRef?: RefObject<HTMLElement | null>
  onCellSave?: (value: any, columnName: string, rowId: string) => void;
};

type ColumnHeaderProps = {
  title?: string;
  icon?: IconName;
  showDropdownIcon?: boolean;
};

type ColumnMeta = {
  type?: FieldType;
  deletable?: boolean;
  id: string;
};

// TODO: Update the icon mappings below to use appropriate icons for each field type.
// Currently, many field types are using the same placeholder icon ("formatQuoteClose").
const COLUMN_ICONS: Record<FieldType, IconName> = {
  string: "formatQuoteClose",
  number: "formatQuoteClose",
  date: "formatQuoteClose",
  boolean: "formatQuoteClose",
  textarea: "formatQuoteClose",
  "multiple selection": "formatListChecks",
  relation: "formatQuoteClose",
  location: "mapMarker",
  array: "formatQuoteClose",
  object: "dataObject",
  file: "imageMultiple",
  richtext: "formatQuoteClose"
};

const ColumnHeader = ({title, icon, showDropdownIcon}: ColumnHeaderProps) => {
  return (
    <>
      <div className={styles.columnHeaderText}>
        {icon && <Icon name={icon} size="sm" className={styles.headerIcon} />}
        <span>{title || "\u00A0"}</span>
      </div>
      {showDropdownIcon && (
        <Button variant="icon">
          <Icon name="chevronDown" size="lg" />
        </Button>
      )}
    </>
  );
};

const defaultColumns: ColumnType[] = [
  {
    id: "0",
    header: <ColumnHeader />,
    key: "select",
    type: "boolean",
    width: "41px",
    headerClassName: styles.columnHeader,
    cellClassName: styles.selectCell,
    resizable: false,
    fixed: true,
    selectable: false,
  },
  {
    id: "1",
    header: (
      <Button
        variant="icon"
        className={`${styles.columnHeaderText} ${styles.newFieldColumnButton}`}
      >
        <Icon name={"plus"} size="sm" className={styles.newFieldHeaderIcon} />
        <span>New&nbsp;Field</span>
      </Button>
    ),
    key: "new field",
    width: "125px",
    headerClassName: `${styles.columnHeader} ${styles.newFieldHeader}`,
    cellClassName: styles.newFieldCell,
    resizable: false,
    selectable: false
  }
];

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
  onCellSave
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
    />
  );
};

export default memo(BucketTable);
