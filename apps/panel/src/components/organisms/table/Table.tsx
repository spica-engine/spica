import React, {
  type FC,
  type JSX,
  memo,
  type ReactNode,
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState
} from "react";
import {FlexElement} from "oziko-ui-kit";
import styles from "./Table.module.scss";
import InfiniteScroll from "react-infinite-scroll-component";
import type {ColumnType} from "../bucket-table/BucketTable";
import useScrollDirectionLock from "../../../hooks/useScrollDirectionLock";

type TypeDataColumn = {
  header: string;
  key: string;
  id: string;
  width?: string;
  headerClassName?: string;
  columnClassName?: string;
  cellClassName?: string;
  resizable?: boolean;
  fixed?: boolean;
  selectable?: boolean;
  leftOffset?: number;
};

type TypeTableData = {
  [k: string]: {
    id: string;
    value: string | JSX.Element;
  };
};

type TypeTable = {
  columns: ColumnType[];
  data: TypeTableData[];
  saveToLocalStorage?: {
    id: string;
    save?: boolean;
  };
  className?: string;
  onScrollEnd?: () => void;
  totalDataLength?: number;
  style?: React.CSSProperties;
};

type RowRendererProps = {
  row: any;
  rowIndex: number;
  formattedColumns: TypeDataColumn[];
  focusedCell: {row: number; column: string} | null;
  cellCacheRef: RefObject<Map<string, JSX.Element>>;
  handleCellClick: (columnKey: string, index: number) => void;
};

const MIN_COLUMN_WIDTH = 140;

const parseWidth = (widthValue: string | number, containerWidth: number): number => {
  const baseFontSize = 16;

  if (typeof widthValue === "number") return widthValue;
  if (widthValue.endsWith("px")) return parseFloat(widthValue);
  if (widthValue.endsWith("rem")) return parseFloat(widthValue) * baseFontSize;
  if (widthValue.endsWith("em")) return parseFloat(widthValue) * baseFontSize;
  if (widthValue.endsWith("%")) return (parseFloat(widthValue) / 100) * containerWidth;
  return 0; // fallback for unsupported or auto values
};

function getCalculatedColumnWidth(columns: ColumnType[], containerWidth: number): string {
  const totalDefinedWidth = columns.reduce((total, column) => {
    if (!column.width) return total;
    return total + parseWidth(column.width, containerWidth);
  }, 0);

  const columnsWithoutWidth = columns.filter(column => column.width === undefined)?.length;
  const availableWidth = Math.max(containerWidth - totalDefinedWidth, 0);

  const distributedWidth = availableWidth / columnsWithoutWidth;
  return `${Math.max(distributedWidth, MIN_COLUMN_WIDTH)}px`;
}

const getFormattedColumns = (
  containerWidth: number,
  columns: ColumnType[],
  localStorageOptions?: {
    id: string;
    save?: boolean;
  }
) => {
  const defaultColumnWidth = getCalculatedColumnWidth(columns, containerWidth + 10);

  const columnsWithWidth = columns.map(column => {
    const storedWidth = localStorageOptions?.save
      ? localStorage.getItem(`${localStorageOptions.id}-${column.key}`)
      : null;

    return {
      ...column,
      width: storedWidth || column.width || defaultColumnWidth
    };
  });

  const formattedColumns: ColumnType[] = [];
  let cumulativeOffset = 0;

  for (let column of columnsWithWidth) {
    if (!column.fixed) {
      formattedColumns.push(column);
      continue;
    }

    const columnWidth = parseWidth(column.width, containerWidth);
    const fixedLeftOffset = cumulativeOffset;

    formattedColumns.push({
      ...column,
      width: `${columnWidth}px`,
      leftOffset: fixedLeftOffset
    });

    cumulativeOffset += columnWidth;
  }

  return formattedColumns;
};

const Table: FC<TypeTable> = ({
  columns,
  data,
  saveToLocalStorage = {id: "table", save: false},
  className,
  onScrollEnd,
  totalDataLength,
  style
}) => {
  const containerRef = useScrollDirectionLock();
  const [formattedColumns, setFormattedColumns] = useState<TypeDataColumn[]>([]);
  const [focusedCell, setFocusedCell] = useState<{column: string; row: number} | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const containerWidth = containerRef.current?.clientWidth ?? 0;
    // Making it just a little bit smaller than the container to prevent unnecessary horizontal scrolls
    const formattedColumns = getFormattedColumns(containerWidth - 50, columns);
    setFormattedColumns(formattedColumns);
  }, [columns]);

  useEffect(() => {
    columns.forEach(column => {
      localStorage.setItem(`${saveToLocalStorage.id}-${column.key}`, column.width as string);
    });
  }, [formattedColumns, saveToLocalStorage.save]);

  const updateColumnWidth = useCallback((id: string, newWidth: number) => {
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

  const cellCacheRef = useRef<Map<string, JSX.Element>>(new Map());

  return (
    <>
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
          loader={<div className={styles.loader}/>}
          scrollableTarget="scrollableDiv"
          className={styles.infiniteScroll}
        >
          <table className={`${styles.table} ${className}`} style={style}>
            <thead>
              <tr>
                {formattedColumns.map(col => (
                  <HeaderCell
                    onResize={newWidth =>
                      updateColumnWidth(col.id, Math.max(newWidth, MIN_COLUMN_WIDTH))
                    }
                    key={col.id}
                    className={`${col.headerClassName} ${col.fixed ? styles.fixedCell : ""}`}
                    resizable={col.resizable === undefined ? true : col.resizable}
                    width={col.width}
                    leftOffset={col.leftOffset}
                    tableRef={containerRef}
                  >
                    {col.header}
                  </HeaderCell>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((row, index) => (
                <RowRenderer
                  key={index}
                  row={row}
                  rowIndex={index}
                  formattedColumns={formattedColumns}
                  focusedCell={focusedCell}
                  cellCacheRef={cellCacheRef}
                  handleCellClick={handleCellClick}
                />
              ))}
            </tbody>
          </table>
        </InfiniteScroll>
      </div>
      {!data.length && <div className={styles.noDataText}>No Data Found</div>}
    </>
  );
};

const RowRenderer = memo(
  ({
    row,
    rowIndex,
    formattedColumns,
    focusedCell,
    cellCacheRef,
    handleCellClick
  }: RowRendererProps) => {
    const cells: JSX.Element[] = [];

    for (const column of formattedColumns) {
      const cellData = row[column.key];
      if (!cellData) continue;

      const key = cellData.id;
      const isFocused = focusedCell?.row === rowIndex && focusedCell?.column === column.key;

      const cacheKey = `${key}-${isFocused ? "focused" : "normal"}`;
      const cached = cellCacheRef.current.get(cacheKey);

      if (cached && !isFocused) {
        cells.push(cached);
        continue;
      }

      const cell = (
        <Cell
          key={key}
          onClick={() => column.selectable !== false && handleCellClick(column.key, rowIndex)}
          className={`${column.cellClassName || ""} ${column.fixed ? styles.fixedCell : ""}`}
          width={column.width}
          leftOffset={column.leftOffset}
          focused={isFocused}
        >
          {cellData.value}
        </Cell>
      );

      cellCacheRef.current.set(cacheKey, cell);
      cells.push(cell);
    }

    return <tr>{cells}</tr>;
  }
);

export default memo(Table);

type TypeHeaderCell = {
  className?: string;
  children: ReactNode;
  width?: string | number;
  onResize: (newWidth: number) => void;
  resizable?: boolean;
  leftOffset?: number;
  tableRef: RefObject<HTMLElement | null>;
};

const HeaderCell = ({
  className,
  children,
  width,
  onResize,
  resizable,
  leftOffset,
  tableRef
}: TypeHeaderCell) => {
  const containerRef = useRef<HTMLTableCellElement | null>(null);
  const resizerRef = useRef<HTMLDivElement | null>(null);
  const startX = useRef(0);
  const startWidth = useRef(0);

  function onMouseDown(e: MouseEvent) {
    if (!containerRef.current || !resizable) return;
    startX.current = e.clientX;
    startWidth.current = containerRef.current?.getBoundingClientRect().width;

    function onMouseMove(e: MouseEvent) {
      if (!resizable) return;
      const newWidth = startWidth.current + (e.clientX - startX.current);
      onResize(newWidth);
    }

    function onMouseUp() {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    }

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }

  useEffect(() => {
    const table = tableRef.current;
    if (!table) return;

    const observer = new ResizeObserver(() => {
      if (resizerRef.current) {
        resizerRef.current.style.height = `${table.clientHeight}px`;
      }
    });

    observer.observe(table);

    return () => {
      observer.disconnect();
    };
  }, [tableRef]);

  return (
    <th
      ref={containerRef}
      scope="col"
      className={`${styles.header} ${className || ""}`}
      style={{width, minWidth: width, maxWidth: width, left: leftOffset}}
    >
      <FlexElement dimensionX="fill" alignment="leftCenter" className={styles.headerContent}>
        {children}
      </FlexElement>
      {resizable && (
        <div
          ref={resizerRef}
          onMouseDown={e => onMouseDown(e as unknown as MouseEvent)}
          className={styles.resizer}
        />
      )}
    </th>
  );
};

type TypeCell = React.HTMLAttributes<HTMLDivElement> & {
  focused?: boolean;
  width?: string | number;
  leftOffset?: number;
};

const Cell = ({children, focused, width, leftOffset, ...props}: TypeCell) => {
  return (
    <td
      {...props}
      className={`${styles.cell} ${focused ? styles.focusedCell : ""} ${props.className || ""}`}
      style={{width, minWidth: width, maxWidth: width, left: leftOffset}}
    >
      {children}
    </td>
  );
};
