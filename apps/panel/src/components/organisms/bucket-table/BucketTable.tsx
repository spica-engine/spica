import {Button, Checkbox, Icon, type IconName} from "oziko-ui-kit";
import Table from "../table/Table";
import styles from "./BucketTable.module.scss";
import {memo, useMemo} from "react";

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
  header: any;
  key: string;
  type?: FieldType;
  width?: string;
  deletable?: boolean;
  headerClassName?: string;
  cellClassName?: string;
  columnClassName?: string;
  showDropdownIcon?: boolean;
};

type BucketTableProps = {
  data: any[];
  columns: ColumnType[];
};

type ColumnHeaderProps = {
  title: string;
  icon?: IconName;
  showDropdownIcon?: boolean;
};

const ColumnHeader = ({title, icon, showDropdownIcon}: ColumnHeaderProps) => {
  return (
    <>
      <div className={styles.columnHeaderText}>
        {icon && <Icon name={icon} size="sm" className={styles.headerIcon} />}
        {title}
      </div>
      {showDropdownIcon && (
        <Button variant="icon">
          <Icon name="chevronDown" size="lg" />
        </Button>
      )}
    </>
  );
};

// TODO: Refactor this function to render more appropriate UI elements for each field type.
// Many field types are currently using the generic `renderDefault()`.
function renderCell(cellData: any, type?: FieldType, deletable?: boolean) {
  function renderDefault() {
    return (
      <>
        {cellData}
        {deletable && (
          <Button variant="icon">
            <Icon name="close" size="sm" />
          </Button>
        )}
      </>
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
          {cellData.slice(0, 2).map((_: any, index: number) => (
            <Button variant="icon" className={styles.grayBox}>
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
          {deletable && (
            <Button variant="icon">
              <Icon name="close" size="sm" />
            </Button>
          )}
        </div>
      );
    case "relation":
      return renderDefault();
    case "location":
      return (
        <div className={styles.locationCell}>
          <img src="/locationx.png" className={styles.locationImage} />
          <div>{cellData}</div>
        </div>
      );
    case "array":
      return renderDefault();
    case "object":
      return <div className={styles.objectCell}>{JSON.stringify(cellData)}</div>;
    case "file":
      return (
        <div className={styles.fileCell}>
          <Icon name="imageMultiple" size="xs" />
          <span>{cellData}</span>
        </div>
      );
    case "richtext":
      return renderDefault();
    default:
      return cellData ? JSON.stringify(cellData) : <div />;
  }
}

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

const defaultColumns: ColumnType[] = [
  {
    header: <ColumnHeader title={String.fromCharCode(160)} />,
    key: "select",
    type: "boolean",
    width: "10px",
    columnClassName: styles.selectColumn,
    cellClassName: styles.selectCell
  },
  {
    header: (
      <Button variant="icon" className={`${styles.columnHeaderText} ${styles.newFieldColumnHeader}`}>
        <Icon name={"plus"} size="sm" className={styles.newFieldHeaderIcon} />
        <span>New&nbsp;Field</span>
      </Button>
    ),
    key: "new field",
    width: "10px",
    cellClassName: styles.newFieldCell,
    columnClassName: styles.newFieldColumn
  }
];

const BucketTable = ({data, columns}: BucketTableProps) => {
  const formattedColumns = useMemo(
    () => [
      defaultColumns[0],
      ...columns.map(i => ({
        ...i,
        header: (
          <ColumnHeader
            title={i.header}
            icon={i.type && COLUMN_ICONS[i.type]}
            showDropdownIcon={i.showDropdownIcon}
          />
        )
      })),
      defaultColumns[1]
    ],
    [columns]
  );

  const columnMap = useMemo(() => {
    return Object.fromEntries(
      formattedColumns.map(col => [col.key, {type: col.type, deletable: col.deletable}])
    );
  }, [formattedColumns]);

  const formattedData = useMemo(() => {
    return data.map(item => {
      const fullRow = {
        select: "",
        ...item,
        "new field": ""
      };

      return Object.fromEntries(
        Object.entries(fullRow).map(([key, value]) => {
          const meta = columnMap[key];
          return [key, renderCell(value, meta?.type, meta?.deletable)];
        })
      );
    });
  }, [data, columnMap]);

  return (
    <>
      <Table
        className={styles.table}
        columns={formattedColumns.map(i => ({
          ...i,
          headerClassName: `${i.headerClassName} ${styles.columnHeader}`
        }))}
        data={formattedData}
      />
    </>
  );
};

export default memo(BucketTable);
