import {Button, Icon, type IconName} from "oziko-ui-kit";
import Table from "../table/Table";
import styles from "./BucketTable.module.scss";
import {memo, useCallback, useMemo, type RefObject} from "react";
import Loader from "../../../components/atoms/loader/Loader";
import BucketFieldPopup from "../../molecules/bucket-field-popup/BucketFieldPopup";
import {useBucket} from "../../../contexts/BucketContext";
import type {BucketType} from "src/services/bucketService";
import {createFieldProperty} from "../bucket-add-field/BucketAddFieldUtils";
import {BucketFieldPopupsProvider} from "../../molecules/bucket-field-popup/BucketFieldPopupsContext";
import type {FormValues} from "../bucket-add-field/BucketAddFieldBusiness";
import type { FieldType } from "../table/types";

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
  tableRef?: RefObject<HTMLElement | null>;
  onCellSave: (value: any, columnName: string, rowId: string) => Promise<any>;
  updateCellDataError?: string | null;
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
  richtext: "formatQuoteClose",
  color: "formatQuoteClose",
  multiselect: "formatListChecks"
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

const NewFieldHeader = memo(() => {
  const {buckets, bucketData, createBucketField} = useBucket();

  const bucket = useMemo(
    () => buckets.find(i => i._id === bucketData?.bucketId),
    [buckets, bucketData?.bucketId]
  );
  const handleSaveAndClose = useCallback(
    (values: FormValues) => {
      if (!bucket) return;

      const fieldProperty = createFieldProperty(values);
      const {requiredField, primaryField} = values.configurationValues;
      const {title} = values.fieldValues;

      return createBucketField(
        bucket,
        fieldProperty,
        requiredField ? title : undefined,
        primaryField ? title : undefined
      );
    },
    [bucket, createBucketField]
  );
  const forbiddenFieldNames = useMemo(() => Object.keys(bucket?.properties || {}), [bucket]);

  return (
    <BucketFieldPopupsProvider>
      <BucketFieldPopup
        buckets={buckets}
        bucket={bucket as BucketType}
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

const defaultColumns: ColumnType[] = [
  {
    id: "0",
    header: <ColumnHeader />,
    key: "select",
    type: "boolean",
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
  updateCellDataError
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
    />
  );
};

export default memo(BucketTable);
