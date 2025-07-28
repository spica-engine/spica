import React, {
  type FC,
  type JSX,
  type Key,
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState
} from "react";
import {FlexElement, type TypeFlexElement, type TypeAlignment} from "oziko-ui-kit";
import styles from "./Table.module.scss";
import InfiniteScroll from "react-infinite-scroll-component";
import useSyncedScroll from "../../../hooks/useSyncedScroll";
import type {ColumnType} from "../bucket-table/BucketTable";

type TypeDataColumn = {
  header: string;
  key: string;
  isLastColumn: boolean;
  id?: Key | null;
  width?: string;
  headerClassName?: string;
  columnClassName?: string;
  cellClassName?: string;
};

type TypeTableData = {
  [k: string]: {
    id: string;
    component: string | JSX.Element;
  };
};

type TypeTable = {
  columns: ColumnType[];
  data: TypeTableData[];
  saveToLocalStorage?: {
    id: string;
    save?: boolean;
  };
  fixedColumns?: string[];
  noResizeableColumns?: string[];
  className?: string;
  onScrollEnd?: () => void;
  totalDataLength?: number;
  style?: React.CSSProperties;
};

const MIN_COLUMN_WIDTH = 140;

function getCalculatedWidth(columns: ColumnType[], containerWidth: number): string {
  const baseFontSize = 16;

  const parseWidth = (value: string): number => {
    if (value.endsWith("px")) return parseFloat(value);
    if (value.endsWith("rem")) return parseFloat(value) * baseFontSize;
    if (value.endsWith("em")) return parseFloat(value) * baseFontSize;
    if (value.endsWith("%")) return (parseFloat(value) / 100) * containerWidth;
    return 0; // fallback for unsupported or auto values
  };

  const totalFixedWidth = columns.reduce((sum, col) => {
    if (!col.width) return sum;
    return sum + parseWidth(col.width);
  }, 0);

  const unsetCount = columns.filter(col => col.width === undefined)?.length;
  const remainingWidth = Math.max(containerWidth - totalFixedWidth, 0);

  const autoWidth = remainingWidth / unsetCount;
  return `${Math.max(autoWidth, MIN_COLUMN_WIDTH)}px`;
}

const Table: FC<TypeTable> = ({
  columns,
  data,
  saveToLocalStorage = {id: "table", save: false},
  fixedColumns = [],
  noResizeableColumns = [],
  className,
  onScrollEnd,
  totalDataLength,
  style
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const getDataColumns = useCallback(() => {
    const containerWidth = containerRef.current?.clientWidth ?? 0;
    const calculatedWidth = getCalculatedWidth(columns, containerWidth);
    return columns.map((column, index) => {
      const savedWidth = saveToLocalStorage?.save
        ? localStorage.getItem(`${saveToLocalStorage?.id}-${column.key}`)
        : null;
      return {
        ...column,
        width: savedWidth || column.width || calculatedWidth,
        isLastColumn: index === columns.length - 1
      };
    });
  }, [columns]);

  const [dataColumns, setDataColumns] = useState<TypeDataColumn[]>([]);

  useEffect(() => {
    if (!containerRef.current) return;
    setDataColumns(getDataColumns());
  }, [getDataColumns, columns]);

  const [focusedCell, setFocusedCell] = useState<{column: string; row: number} | null>(null);

  const updateColumnWidth = (key: string, newWidth: string) => {
    setDataColumns(prevColumns =>
      prevColumns.map(col => (col.key === key ? {...col, width: newWidth} : col))
    );
  };

  const saveColumns = (columns: TypeDataColumn[], tableId: string) => {
    columns.forEach(column => {
      localStorage.setItem(`${tableId}-${column.key}`, column.width as string);
    });
  };

  useEffect(() => {
    saveColumns(dataColumns, saveToLocalStorage.id);
  }, [dataColumns, saveToLocalStorage.save]);

  const handleCellClick = (columnKey: string, index: number) => {
    setFocusedCell({column: columnKey, row: index});
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const currentColumnIndex = columns.findIndex(col => col.key === focusedCell?.column);
      const currentRowIndex = focusedCell?.row;
      switch (event.key) {
        case "ArrowRight":
          if (currentColumnIndex < columns.length - 1) {
            setFocusedCell({column: columns[currentColumnIndex + 1].key, row: currentRowIndex!});
          }
          break;
        case "ArrowLeft":
          if (currentColumnIndex > 0) {
            setFocusedCell({column: columns[currentColumnIndex - 1].key, row: currentRowIndex!});
          }
          break;
        case "ArrowDown":
          if (currentRowIndex! < data.length - 1) {
            setFocusedCell({column: focusedCell?.column!, row: currentRowIndex! + 1});
          }
          break;
        case "ArrowUp":
          if (currentRowIndex! > 0) {
            setFocusedCell({column: focusedCell?.column!, row: currentRowIndex! - 1});
          }
          break;
        default:
          break;
      }
    };

    if (focusedCell) {
      window.addEventListener("keydown", handleKeyDown);
    }

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [focusedCell]);

  const setSyncedScrollElements = useSyncedScroll(dataColumns.length, containerRef);
  return (
    <>
      <div ref={containerRef} className={`${styles.table} ${className}`} style={style}>
        {dataColumns.map(column => (
          <ColumnRenderer
            key={column.id}
            fixedColumns={fixedColumns}
            column={column}
            dataColumns={dataColumns}
            focusedCell={focusedCell}
            setSyncedScrollElements={setSyncedScrollElements}
            updateColumnWidth={updateColumnWidth}
            noResizeableColumns={noResizeableColumns}
            onScrollEnd={onScrollEnd}
            totalDataLength={totalDataLength}
            data={data}
            isLastColumn={column.isLastColumn}
          />
        ))}
      </div>
      {!data.length && <div className={styles.noDataText}>No Data Found</div>}
    </>
  );
};

export default memo(Table);

type ColumnRendererProps = {
  fixedColumns: string[];
  column: TypeDataColumn;
  dataColumns: TypeDataColumn[];
  focusedCell: {
    column: string;
    row: number;
  } | null;
  setSyncedScrollElements: (el: HTMLDivElement | null, identifier: string) => void;
  updateColumnWidth: (key: string, newWidth: string) => void;
  noResizeableColumns: string[];
  onScrollEnd?: () => void;
  totalDataLength?: number;
  data: TypeTableData[];
  isLastColumn: boolean;
};

type ColumnCellsRendererProps = {
  data: TypeTableData[];
  focusedCell: {
    column: string;
    row: number;
  } | null;
  column: TypeDataColumn;
};

const ColumnCellsRenderer = memo(({data, focusedCell, column}: ColumnCellsRendererProps) => {
  const prevCellsRef = useRef<Map<string, JSX.Element>>(new Map());

  const cells: JSX.Element[] = [];

  data.forEach((row, index) => {
    const value = row[column.key];
    if (!value) return;

    const key = value.id;
    const isFocused = focusedCell?.column === column.key && focusedCell?.row === index;

    const prev = prevCellsRef.current.get(key);

    if (prev && !isFocused) {
      cells.push(prev);
    } else {
      const newCell = (
        <Column.Cell
          key={key}
          children={value.component}
          focused={isFocused}
          className={column.cellClassName}
        />
      );

      prevCellsRef.current.set(key, newCell);
      cells.push(newCell);
    }
  });

  const currentKeys = new Set(data.map(row => row[column.key]?.id));
  for (const key of prevCellsRef.current.keys()) {
    if (!currentKeys.has(key)) {
      prevCellsRef.current.delete(key);
    }
  }

  return <>{cells}</>;
});

const ColumnRenderer = memo(
  ({
    fixedColumns,
    column,
    dataColumns,
    focusedCell,
    setSyncedScrollElements,
    updateColumnWidth,
    noResizeableColumns,
    onScrollEnd,
    totalDataLength,
    data,
    isLastColumn
  }: ColumnRendererProps) => {
    const isFixed = useMemo(() => fixedColumns.includes(column.key), [fixedColumns.length]);
    const positionAmount = useMemo(
      () =>
        isFixed
          ? fixedColumns
              .slice(0, fixedColumns.indexOf(column.key))
              .reduce(
                (acc, curr) =>
                  acc + parseInt(dataColumns.find(dc => dc.key === curr)?.width ?? "0"),
                0
              ) + "px"
          : "unset",
      [isFixed]
    );

    return (
      <Column
        id={isLastColumn ? `scrollableDiv-${column.key}` : undefined}
        ref={ref => setSyncedScrollElements(ref, column.key)}
        columnKey={column.key}
        className={`${styles.column} ${isFixed ? styles.fixedColumns : styles.scrollableColumns} ${column.columnClassName}`}
        style={{
          left: positionAmount
        }}
        width={column.width}
        updateColumnWidth={updateColumnWidth}
        noResizeable={noResizeableColumns.includes(column.key)}
      >
        <Column.Header className={column.headerClassName}>{column.header}</Column.Header>
        {isLastColumn ? (
          <InfiniteScroll
            next={() => {
              onScrollEnd?.();
            }}
            hasMore={totalDataLength !== undefined && totalDataLength > data.length}
            loader={"Loading.."}
            dataLength={data.length}
            scrollableTarget={`scrollableDiv-${column.key}`}
          >
            <ColumnCellsRenderer data={data} focusedCell={focusedCell} column={column} />
          </InfiniteScroll>
        ) : (
          <ColumnCellsRenderer data={data} focusedCell={focusedCell} column={column} />
        )}
      </Column>
    );
  }
);

type TypeColumn = {
  columnKey?: string;
  children?: React.ReactNode;
  ref?: React.Ref<HTMLDivElement>;
  className?: string;
  width?: string;
  updateColumnWidth?: (key: string, newWidth: string) => void;
  noResizeable?: boolean;
  style?: React.CSSProperties;
  id?: string;
};

type TypeColumnComponent = React.FC<TypeColumn> & {
  Header: typeof HeaderCell;
  Cell: typeof Cell;
};

const ColumnComponent = ({
  columnKey,
  children,
  ref,
  className,
  width,
  updateColumnWidth,
  noResizeable,
  style,
  id
}: TypeColumn) => {
  const [columnWidth, setColumnWidth] = useState(width);
  const [isResizing, setIsResizing] = useState(false);
  const [isResized, setIsResized] = useState(false);
  const columnRef = useRef<HTMLDivElement>(null);

  useEffect(() => setColumnWidth(width), [width]);

  useImperativeHandle(ref, () => columnRef.current!, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isResizing && columnRef.current) {
        const newWidth = e.clientX - columnRef.current.getBoundingClientRect().left;
        setColumnWidth(`${Math.max(newWidth, MIN_COLUMN_WIDTH)}px`);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      setIsResized(true);
      if (columnRef.current) {
        const newWidth = columnRef.current.style.minWidth;
        updateColumnWidth?.(columnKey!, newWidth);
      }
    };

    if (isResizing) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing, columnKey, updateColumnWidth]);

  const handleMouseDown = () => {
    const selection = window.getSelection();
    if (selection && selection.removeAllRanges) {
      selection.removeAllRanges();
    }
    setIsResizing(true);
  };

  return (
    <div
      id={id}
      ref={columnRef}
      className={`${className} ${isResizing ? styles.resizingColumn : ""} ${isResized ? styles.resizedColumn : ""}`}
      style={{...style, maxWidth: columnWidth, minWidth: columnWidth, width: columnWidth}}
    >
      {children}
      {!noResizeable && <div className={styles.resizer} onMouseDown={handleMouseDown} />}
    </div>
  );
};

type TypeHeaderCell = TypeFlexElement & {
  border?: boolean;
  headerAlign?: "left" | "center" | "right";
};

const HeaderCell = ({
  border = true,
  headerAlign = "center",
  children,
  ...props
}: TypeHeaderCell) => {
  const align: Record<string, TypeAlignment> = {
    left: "leftTop",
    center: "center",
    right: "rightTop"
  };

  return (
    <FlexElement
      dimensionX="fill"
      alignment={align[headerAlign]}
      {...props}
      className={`${styles.header} ${border ? styles.border : ""} ${props.className || ""}`}
    >
      {children}
    </FlexElement>
  );
};

type TypeCell = React.HTMLAttributes<HTMLDivElement> & {
  focused?: boolean;
};

const Cell = ({children, focused, ...props}: TypeCell) => {
  return (
    <div
      {...props}
      className={`${styles.cell} ${focused ? styles.focusedCell : ""} ${props.className || ""}`}
    >
      {children}
    </div>
  );
};

const Column = memo(ColumnComponent) as unknown as TypeColumnComponent;

Column.Header = HeaderCell;
Column.Cell = memo(Cell) as typeof Cell;
