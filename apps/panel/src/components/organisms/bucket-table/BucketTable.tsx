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
import type {BucketType} from "src/services/bucketService";
import {createFieldProperty} from "../bucket-add-field/BucketAddFieldUtils";
import {BucketFieldPopupsProvider} from "../../molecules/bucket-field-popup/BucketFieldPopupsContext";
import type {FormValues} from "../bucket-add-field/BucketAddFieldBusiness";
import ColumnActionsMenu from "../../molecules/column-actions-menu/ColumnActionsMenu";

type FieldType =
  | "string"
  | "number"
  | "date"
  | "boolean"
  | "textarea"
  | "multiple selection"
  | "relation"
  | "location"
  | "array"
  | "object"
  | "file"
  | "richtext";

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

// TODO: Refactor this function to render more appropriate UI elements for each field type.
// Many field types are currently using the generic `renderDefault()`.
function renderCell(cellData: any, type?: FieldType, deletable?: boolean) {
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
  switch (type) {
    case "string":
      return renderDefault();
    case "number":
      return renderDefault();
    case "date":
      return renderDefault();
    case "boolean":
      return <Checkbox className={styles.checkbox} />;
    case "textarea":
      return renderDefault();
    case "multiple selection":
      return (
        <div className={styles.multipleSelectionCell}>
          {cellData?.slice(0, 2)?.map?.((_: any, index: number) => (
            <Button key={index} variant="icon" className={styles.grayBox}>
              {index + 1}
            </Button>
          ))}
          {cellData.length > 2 && (
            <Button variant="icon" className={styles.grayBox}>
              <Icon name="dotsHorizontal" size="xs" />
            </Button>
          )}
          <Button variant="icon" className={styles.grayBox}>
            <Icon name="plus" size="xs" />
          </Button>
          {deletable && cellData && (
            <Button variant="icon">
              <Icon name="close" size="sm" />
            </Button>
          )}
        </div>
      );
    case "relation":
      return (
        <div className={styles.defaultCell}>
          <div className={styles.defaultCellData}>{JSON.stringify(cellData)}</div>
          {deletable && cellData && (
            <Button variant="icon">
              <Icon name="close" size="sm" />
            </Button>
          )}
        </div>
      );
    case "location":
      return (
        <div className={styles.locationCell}>
          <img src="/locationx.png" className={styles.locationImage} />
          <div
            data-full={cellData?.coordinates.join(", ")}
            onCopy={e => {
              e.preventDefault();
              e.clipboardData.setData("text/plain", e.currentTarget.dataset.full || "");
            }}
          >
            {cellData?.coordinates?.map((c: number) => c.toFixed(2) + "..").join(", ")}
          </div>
        </div>
      );
    case "array":
      return (
        <div className={styles.defaultCell}>
          <div className={styles.defaultCellData}>{JSON.stringify(cellData)}</div>
          {deletable && cellData && (
            <Button variant="icon">
              <Icon name="close" size="sm" />
            </Button>
          )}
        </div>
      );
    case "object":
      return (
        <div className={styles.defaultCell}>
          <div className={styles.defaultCellData}>{JSON.stringify(cellData)}</div>
          {!deletable && cellData && (
            <Button variant="icon">
              <Icon name="close" size="sm" />
            </Button>
          )}
        </div>
      );
    case "file":
      return (
        <div className={styles.fileCell}>
          <Icon name="imageMultiple" size="xs" />
          {cellData ? (
            <span>{cellData}</span>
          ) : (
            <span className={styles.grayText}>Click or Drag&Drop</span>
          )}
        </div>
      );
    case "richtext":
      return renderDefault();
    default: {
      if (!cellData) {
        return <div />;
      }

      if (typeof cellData === "string") {
        return cellData;
      }

      return JSON.stringify(cellData);
    }
  }
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
