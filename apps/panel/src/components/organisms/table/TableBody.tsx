import {memo, useRef, type JSX, useEffect} from "react";
import type {TypeDataColumn, TypeTableData} from "./types";
import styles from "./Table.module.scss";
import {Cell, EditableCell} from "./Cell";

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
