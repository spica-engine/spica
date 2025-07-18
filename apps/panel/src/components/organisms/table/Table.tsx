import React, {type FC, memo, useEffect, useImperativeHandle, useRef, useState} from "react";
import {FlexElement, type TypeFlexElement, type TypeAlignment} from "oziko-ui-kit";
import styles from "./Table.module.scss";
import InfiniteScroll from "react-infinite-scroll-component";
import useSyncedScroll from "../../../hooks/useSyncedScroll";

type TypeTable = {
  columns: any[];
  data: any[];
  saveToLocalStorage?: {
    id: string;
    save?: boolean;
  };
  fixedColumns?: string[];
  noResizeableColumns?: string[];
  className?: string;
  onScrollEnd?: () => void;
  totalDataLength: number;
  style?: React.CSSProperties;
};

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
  const getDataColumns = () => {
    return columns.map(column => {
      const savedWidth = saveToLocalStorage?.save
        ? localStorage.getItem(`${saveToLocalStorage?.id}-${column.key}`)
        : null;
      return {
        ...column,
        width: savedWidth || column.width || "300px"
      };
    });
  };

  const [dataColumns, setDataColumns] = useState(getDataColumns());

  useEffect(() => setDataColumns(getDataColumns()), [columns.length]);

  const [focusedCell, setFocusedCell] = useState<{column: string; row: number} | null>(null);

  const updateColumnWidth = (key: string, newWidth: string) => {
    setDataColumns((prevColumns: any) =>
      prevColumns.map((col: any) => (col.key === key ? {...col, width: newWidth} : col))
    );
  };

  const saveColumns = (columns: any[], tableId: string) => {
    columns.forEach(column => {
      localStorage.setItem(`${tableId}-${column.key}`, column.width);
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

  const setSyncedScrollElements = useSyncedScroll(dataColumns.length);
  return (
    <>
      <div className={`${styles.table} ${className}`} style={style}>
        {dataColumns.map((column, index) => {
          const isFixed = fixedColumns.includes(column.key);
          const positionAmount = isFixed
            ? fixedColumns
                .slice(0, fixedColumns.indexOf(column.key))
                .reduce(
                  (acc, curr) => acc + parseInt(dataColumns.find(dc => dc.key === curr).width),
                  0
                ) + "px"
            : "unset";
          const cells = (
            <>
              {data.map(
                (row: any, index: number) =>
                  row[column.key] && (
                    <Column.Cell
                      key={`${row[column.key]}-${index}`}
                      className={column.cellClassName}
                      focused={focusedCell?.column === column.key && focusedCell?.row === index}
                    >
                      {row[column.key]}
                    </Column.Cell>
                  )
              )}
            </>
          );

          return (
            <Column
              id={index === dataColumns.length - 1 ? `scrollableDiv-${index}` : undefined}
              key={column.key}
              ref={ref => setSyncedScrollElements(ref, index)}
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
              {index === dataColumns.length - 1 ? (
                <InfiniteScroll
                  next={() => {
                    onScrollEnd?.();
                  }}
                  hasMore={totalDataLength > data.length}
                  loader={"Loading.."}
                  dataLength={data.length}
                  scrollableTarget={`scrollableDiv-${index}`}
                >
                  {cells}
                </InfiniteScroll>
              ) : (
                <>{cells}</>
              )}
            </Column>
          );
        })}
      </div>
      {!data.length && <div className={styles.noDataText}>No Data Found</div>}
    </>
  );
};

export default memo(Table);

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
  const columnRef = useRef<HTMLDivElement>(null);

  useImperativeHandle(ref, () => columnRef.current!, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isResizing && columnRef.current) {
        const newWidth = e.clientX - columnRef.current.getBoundingClientRect().left;
        setColumnWidth(`${newWidth}px`);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
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

  return (
    <div id={id} ref={columnRef} className={className} style={{...style, minWidth: columnWidth}}>
      {children}
      {!noResizeable && <div className={styles.resizer} onMouseDown={() => setIsResizing(true)} />}
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
Column.Cell = Cell;
