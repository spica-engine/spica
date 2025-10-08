import React, {
  memo,
  type RefObject,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useState
} from "react";
import styles from "./Table.module.scss";
import InfiniteScroll from "react-infinite-scroll-component";
import useScrollDirectionLock from "../../../hooks/useScrollDirectionLock";
import Loader from "../../../components/atoms/loader/Loader";
import type {TypeDataColumn, TypeTableData} from "./types";
import {TableHeader} from "./TableHeader";
import {TableBody} from "./TableBody";
import {TableEditContext} from "./TableEditContext";
import {getFormattedColumns, parseWidth} from "./columnUtils";

export type TableProps = {
  columns: TypeDataColumn[];
  data: TypeTableData[];
  className?: string;
  onScrollEnd?: () => void;
  totalDataLength?: number;
  style?: React.CSSProperties;
  tableRef?: RefObject<HTMLElement | null>;
  onCellSave?: (value: any, columnName: string, rowId: string) => Promise<any>;
  requiredColumns?: string[];
};

function Table({
  columns,
  data,
  className,
  onScrollEnd,
  totalDataLength,
  style,
  onCellSave,
  tableRef,
  requiredColumns = []
}: TableProps) {
  const containerRef = useScrollDirectionLock();
  useImperativeHandle(tableRef, () => containerRef.current as HTMLElement);

  const [formattedColumns, setFormattedColumns] = useState<TypeDataColumn[]>([]);
  const [focusedCell, setFocusedCell] = useState<{column: string; row: number} | null>(null);
  const [isCellEditing, setIsCellEditing] = React.useState(false);
  const registerActiveCell = () => setIsCellEditing(true);
  const unregisterActiveCell = () => setIsCellEditing(false);

  useLayoutEffect(() => {
    if (!containerRef.current) return;
    const containerWidth = containerRef.current?.clientWidth ?? 0;
    const formattedColumns = getFormattedColumns(containerWidth, columns);
    setFormattedColumns(formattedColumns);
    setFocusedCell(null);
  }, [columns]);

  const handleColumnWidthChange = useCallback(() => {
    if (!containerRef.current) return;
    const containerWidth = containerRef.current?.clientWidth ?? 0;
    const formattedColumns = getFormattedColumns(containerWidth, columns);
    setFormattedColumns(formattedColumns);
    setFocusedCell(null);
  }, [columns]);

  useLayoutEffect(() => {
    handleColumnWidthChange();
    window.addEventListener("resize", handleColumnWidthChange);
    return () => {
      window.removeEventListener("resize", handleColumnWidthChange);
    };
  }, [columns]);

  const handleColumnResize = useCallback((id: string, newWidth: number) => {
    setFormattedColumns(prevColumns =>
      prevColumns.map(col => (col.id === id ? {...col, width: `${newWidth}px`} : col))
    );
  }, []);

  const handleCellClick = (columnKey: string, index: number) => {
    if (focusedCell?.column === columnKey && focusedCell.row === index) setFocusedCell(null);
    else setFocusedCell({column: columnKey, row: index});
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isCellEditing) return;
      const focusedColumnIndex = columns.findIndex(col => col.key === focusedCell?.column);
      const focusedRowIndex = focusedCell?.row;

      if (focusedColumnIndex === -1 || focusedRowIndex === undefined) return;

      const nextColumnIndex =
        event.key === "ArrowRight" ? focusedColumnIndex + 1 : focusedColumnIndex - 1;
      const nextRowIndex = event.key === "ArrowDown" ? focusedRowIndex + 1 : focusedRowIndex - 1;

      const isSelectableColumn = (index: number) => columns[index]?.selectable !== false;
      const isSelectableRow = (index: number) => index >= 0 && index < data.length;

      if (
        event.key === "ArrowRight" &&
        nextColumnIndex < columns.length &&
        isSelectableColumn(nextColumnIndex)
      ) {
        setFocusedCell({column: columns[nextColumnIndex].key, row: focusedRowIndex});
      } else if (
        event.key === "ArrowLeft" &&
        nextColumnIndex >= 0 &&
        isSelectableColumn(nextColumnIndex)
      ) {
        setFocusedCell({column: columns[nextColumnIndex].key, row: focusedRowIndex});
      } else if (
        event.key === "ArrowDown" &&
        nextRowIndex < data.length &&
        isSelectableRow(nextRowIndex)
      ) {
        setFocusedCell({column: columns[focusedColumnIndex].key, row: nextRowIndex});
      } else if (event.key === "ArrowUp" && nextRowIndex >= 0 && isSelectableRow(nextRowIndex)) {
        setFocusedCell({column: columns[focusedColumnIndex].key, row: nextRowIndex});
      }
    };

    if (focusedCell) {
      window.addEventListener("keydown", handleKeyDown);
    }

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [focusedCell]);

  const totalTableWidth = useMemo(() => {
    return formattedColumns.reduce((total, col) => {
      return total + parseWidth(col.width || "0", 0);
    }, 0);
  }, [formattedColumns]);

  return (
    <TableEditContext value={{onCellSave, registerActiveCell, unregisterActiveCell}}>
      <div
        ref={containerRef as RefObject<HTMLDivElement>}
        id="scrollableDiv"
        className={styles.container}
      >
        <InfiniteScroll
          dataLength={data.length}
          next={() => {
            onScrollEnd?.();
          }}
          hasMore={totalDataLength !== undefined && totalDataLength > data.length}
          loader={<Loader />}
          scrollableTarget="scrollableDiv"
          className={styles.infiniteScroll}
        >
          <table
            className={`${styles.table} ${className}`}
            style={{...style, width: `${totalTableWidth}px`, minWidth: `${totalTableWidth}px`}}
          >
            <TableHeader formattedColumns={formattedColumns} onColumnResize={handleColumnResize} />
            <tbody>
              {formattedColumns.length > 0 && (
                <TableBody
                  formattedColumns={formattedColumns}
                  focusedCell={focusedCell}
                  handleCellClick={handleCellClick}
                  data={data}
                  requiredColumns={requiredColumns}
                />
              )}
            </tbody>
          </table>
        </InfiniteScroll>
      </div>
      {!data.length && <div className={styles.noDataText}>No Data Found</div>}
    </TableEditContext>
  );
}

export default memo(Table);
