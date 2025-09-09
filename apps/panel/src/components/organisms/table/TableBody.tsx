import {memo, useRef, type JSX, useEffect, useState} from "react";
import type {FieldType, TypeDataColumn, TypeTableData} from "./types";
import styles from "./Table.module.scss";
import {Button, Icon, Checkbox} from "oziko-ui-kit";
import {isValidDate} from "./EditCellPopover";
import {Cell, EditableCell} from "./Cell";

// TODO: Refactor this function to render more appropriate UI elements for each field type.
// Many field types are currently using the generic `renderDefault()`.
export function renderCell(cellData: any, type?: FieldType, deletable?: boolean) {
  function renderDefault(data?: any): JSX.Element {
    return (
      <div className={styles.defaultCell}>
        <div className={styles.defaultCellData}>{data ?? cellData}</div>
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
      if (!cellData || !isValidDate(new Date(cellData))) return renderDefault("");
      const dateObj = new Date(cellData);
      const formattedDate = dateObj.toLocaleString("en-US", {
        month: "numeric",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true
      });

      return (
        <div className={styles.defaultCell}>
          <div className={styles.defaultCellData}>{formattedDate}</div>
          {deletable && cellData && (
            <Button variant="icon">
              <Icon name="close" size="sm" />
            </Button>
          )}
        </div>
      );
    case "boolean":
      return <Checkbox className={styles.checkbox} checked={cellData} />;
    case "textarea":
      return renderDefault();
    case "multiple selection":
    case "multiselect":
      return (
        <div className={styles.multipleSelectionCell}>
          {cellData?.slice(0, 2)?.map?.((_: any, index: number) => (
            <Button key={index} variant="icon" className={styles.grayBox}>
              {index + 1}
            </Button>
          ))}
          {cellData?.length > 2 && (
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
            data-full={cellData?.coordinates?.join(", ")}
            onCopy={e => {
              e.preventDefault();
              e.clipboardData.setData("text/plain", e.currentTarget.dataset.full || "");
            }}
          >
            {cellData?.coordinates?.map((c: number) => c?.toFixed(2) + "..").join(", ")}
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

export type TypeCell = React.HTMLAttributes<HTMLDivElement> & {
  leftOffset?: number;
  type: FieldType;
  value: any;
  deletable?: boolean;
};

type TableBodyProps = {
  formattedColumns: TypeDataColumn[];
  focusedCell: {row: number; column: string} | null;
  handleCellClick: (columnKey: string, index: number) => void;
  data: TypeTableData[];
};

export const TableBody = memo(
  ({data, formattedColumns, focusedCell, handleCellClick}: TableBodyProps) => {
    const rowCacheRef = useRef<
      Map<string, {element: JSX.Element; lastFocusedCell: string | null; rowContentString: string}>
    >(new Map());
    const rows: JSX.Element[] = [];

    for (let index = 0; index < data.length; index++) {
      const row = data[index];
      // If a cell is changed, we need to re-render the row
      const rowContentString = formattedColumns
        .map(column => JSON.stringify(row[column.key]?.value))
        .join("-");
      const rowId = row[Object.keys(row)[0]].id;
      const missingCellData = formattedColumns.some(column => !row[column.key]);
      if (missingCellData) continue;

      const focusedKey = focusedCell ? `${focusedCell.row}-${focusedCell.column}` : null;
      const cached = rowCacheRef.current.get(rowId);

      const isFocusedInThisRow = focusedCell?.row === index;

      if (
        cached &&
        cached.rowContentString === rowContentString &&
        !isFocusedInThisRow &&
        (!focusedKey || cached.lastFocusedCell === focusedKey)
      ) {
        rows.push(cached.element);
        continue;
      }

      const cells = formattedColumns.map(column => {
        const cellData = row[column.key];

        const props = {
          onClick: () => column.selectable !== false && handleCellClick(column.key, index),
          className: `${column.cellClassName || ""} ${column.fixed ? styles.fixedCell : ""}`,
          leftOffset: column.leftOffset,
          value: cellData.value,
          type: column.type ?? "string",
          deletable: column.deletable
        };

        return column.selectable !== false ? (
          <EditableCell
            key={cellData.id}
            {...props}
            type={column.type ?? "string"}
            focused={focusedCell?.row === index && focusedCell?.column === column.key}
            title={column.title ?? "Value"}
            columnId={column.key}
            rowId={rowId.split("-")[1]}
            constraints={{
              pattern: column.pattern,
              minimum: column.minimum,
              maximum: column.maximum,
              maxItems: column.maxItems,
              minItems: column.minItems,
              items: column.items,
              properties: column.properties
            }}
          />
        ) : (
          <Cell key={cellData.id} {...props} />
        );
      });

      const rowElement = <tr key={rowId}>{cells}</tr>;
      rowCacheRef.current.set(rowId, {
        rowContentString,
        element: rowElement,
        lastFocusedCell: focusedKey
      });
      rows.push(rowElement);
    }

    useEffect(() => {
      const currentBaseIds = new Set(data.map(row => row[Object.keys(row)[0]].id));
      for (const cachedBaseId of rowCacheRef.current.keys()) {
        if (!currentBaseIds.has(cachedBaseId)) {
          rowCacheRef.current.delete(cachedBaseId);
        }
      }
    }, [data]);

    return <>{rows}</>;
  }
);
