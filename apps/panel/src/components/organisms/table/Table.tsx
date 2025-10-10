import React, {
  type FC,
  type JSX,
  memo,
  type ReactNode,
  type RefObject,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from "react";
import {FlexElement} from "oziko-ui-kit";
import styles from "./Table.module.scss";
import InfiniteScroll from "react-infinite-scroll-component";
import useScrollDirectionLock from "../../../hooks/useScrollDirectionLock";
import Loader from "../../../components/atoms/loader/Loader";

export type TypeDataColumn = {
  header: string | ReactNode;
  key: string;
  id: string;
  width?: string;
  headerClassName?: string;
  cellClassName?: string;
  resizable?: boolean;
  fixed?: boolean;
  selectable?: boolean;
  leftOffset?: number;
  fixedWidth?: boolean;
};

type TypeTableData = {[k: string]: {id: string; value: string | JSX.Element}};

type TypeTable = {
  columns: TypeDataColumn[];
  data: TypeTableData[];
  className?: string;
  onScrollEnd?: () => void;
  totalDataLength?: number;
  style?: React.CSSProperties;
  tableRef?: RefObject<HTMLElement | null>;
};

const MIN_COLUMN_WIDTH = 140;

function extractTextFromReactNode(value: ReactNode | string): string {
  const extractText = (node: ReactNode): string[] => {
    if (node == null || typeof node === "boolean") {
      return [];
    }

    if (typeof node === "string") {
      return [node];
    }

    if (typeof node === "number") {
      return [node.toString()];
    }

    if (Array.isArray(node)) {
      return node.flatMap(extractText);
    }

    if (React.isValidElement(node)) {
      if (node.type === React.Fragment) {
        const props = (node as React.ReactElement).props;
        if (props && typeof props === "object" && "children" in props) {
          return extractText(props.children as ReactNode);
        }
        return [];
      }

      if (
        typeof node === "object" &&
        node !== null &&
        "props" in node &&
        typeof (node as any).props === "object" &&
        (node as any).props &&
        "children" in (node as any).props &&
        (node as any).props.children != null
      ) {
        return extractText((node as any).props.children);
      }

      return [];
    }

    if (typeof node === "object" && node !== null) {
      const obj = node as any;
      if (obj.props && obj.props.children) {
        return extractText(obj.props.children);
      }
    }

    return [];
  };

  return extractText(value).join("");
}

const parseWidth = (widthValue: string | number, containerWidth: number): number => {
  const baseFontSize = 16;

  if (typeof widthValue === "number") return widthValue;
  if (widthValue.endsWith("px")) return parseFloat(widthValue);
  if (widthValue.endsWith("rem")) return parseFloat(widthValue) * baseFontSize;
  if (widthValue.endsWith("em")) return parseFloat(widthValue) * baseFontSize;
  if (widthValue.endsWith("%")) return (parseFloat(widthValue) / 100) * containerWidth;
  return 0; // fallback for unsupported or auto values
};

function getCalculatedColumnWidth(columns: TypeDataColumn[], containerWidth: number): string {
  const totalDefinedWidth = columns.reduce((total, column) => {
    if (!column.width) return total;
    return total + parseWidth(column.width, containerWidth);
  }, 0);

  const columnsWithoutWidth = columns.filter(column => column.width === undefined)?.length;
  const availableWidth = Math.max(containerWidth - totalDefinedWidth, 0);

  const distributedWidth = availableWidth / columnsWithoutWidth;
  return `${Math.max(distributedWidth, MIN_COLUMN_WIDTH)}px`;
}

const getFormattedColumns = (containerWidth: number, columns: TypeDataColumn[]) => {
  const allColumnsHaveWidth =
    columns.filter(col => (col.width !== undefined || col.width !== null)).length === columns.length;

  if (allColumnsHaveWidth) {
    const fixedWidthColumns = columns.filter(col => col.fixedWidth);
    const resizableColumns = columns.filter(col => !col.fixedWidth);

    const fixedWidthTotal = fixedWidthColumns.reduce(
      (total, col) => total + parseWidth(col.width as string, containerWidth),
      0
    );

    const remainingWidth = Math.max(containerWidth - fixedWidthTotal, 0);

    const resizableColumnsLength = Math.max(resizableColumns.length, 1);
    const widthPerResizableColumn = remainingWidth / resizableColumnsLength;

    return columns.map(col => ({
      ...col,
      width: col.fixedWidth ? col.width : `${widthPerResizableColumn}px`
    }));
  }
  const defaultColumnWidth = getCalculatedColumnWidth(columns, containerWidth);

  const columnsWithWidth = columns.map(column => {
    return {...column, width: column.width || defaultColumnWidth};
  });

  const formattedColumns: TypeDataColumn[] = [];
  let cumulativeOffset = 0;

  for (let column of columnsWithWidth) {
    if (!column.fixed) {
      formattedColumns.push(column);
      continue;
    }

    const columnWidth = parseWidth(column.width, containerWidth);
    const fixedLeftOffset = cumulativeOffset;

    formattedColumns.push({...column, width: `${columnWidth}px`, leftOffset: fixedLeftOffset});

    cumulativeOffset += columnWidth;
  }

  return formattedColumns;
};

const Table: FC<TypeTable> = ({
  columns,
  data,
  className,
  onScrollEnd,
  totalDataLength,
  style,
  tableRef
}) => {
  const containerRef = useScrollDirectionLock();
  useImperativeHandle(tableRef, () => containerRef.current as HTMLElement);

  const [formattedColumns, setFormattedColumns] = useState<TypeDataColumn[]>([]);
  const [focusedCell, setFocusedCell] = useState<{column: string; row: number} | null>(null);

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

  // Calculate total table width to ensure fixed layout works properly
  const totalTableWidth = useMemo(() => {
    return formattedColumns.reduce((total, col) => {
      return total + parseWidth(col.width || "0", 0);
    }, 0);
  }, [formattedColumns]);

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
                <Rows
                  formattedColumns={formattedColumns}
                  focusedCell={focusedCell}
                  handleCellClick={handleCellClick}
                  data={data}
                />
              )}
            </tbody>
          </table>
        </InfiniteScroll>
      </div>
      {!data.length && <div className={styles.noDataText}>No Data Found</div>}
    </>
  );
};

type TableHeaderProps = {
  formattedColumns: TypeDataColumn[];
  onColumnResize: (id: string, newWidth: number) => void;
};

const TableHeader = memo(({formattedColumns, onColumnResize}: TableHeaderProps) => {
  const updateColumnWidth = useCallback(
    (id: string, newWidth: number) => {
      onColumnResize(id, Math.max(newWidth, MIN_COLUMN_WIDTH));
    },
    [onColumnResize]
  );

  const colElements = useMemo(
    () =>
      formattedColumns.map(col => (
        <col
          id={col.id}
          key={col.id}
          style={{width: col.width, minWidth: col.width, maxWidth: col.width}}
        />
      )),
    [formattedColumns]
  );

  const headerCells = useMemo(
    () =>
      formattedColumns.map(col => (
        <HeaderCell
          onResize={newWidth => updateColumnWidth(col.id, newWidth)}
          key={col.id}
          className={`${col.headerClassName} ${col.fixed ? styles.fixedCell : ""}`}
          resizable={col.resizable === undefined ? true : col.resizable}
          leftOffset={col.leftOffset}
        >
          {col.header}
        </HeaderCell>
      )),
    [formattedColumns, updateColumnWidth]
  );

  return (
    <>
      <colgroup>{colElements}</colgroup>
      <thead>
        <tr>{headerCells}</tr>
      </thead>
    </>
  );
});

type TypeHeaderCell = {
  className?: string;
  children: ReactNode;
  onResize: (newWidth: number) => void;
  resizable?: boolean;
  leftOffset?: number;
};

const HeaderCell = memo(
  ({className, children, onResize, resizable, leftOffset}: TypeHeaderCell) => {
    const headerRef = useRef<HTMLTableCellElement | null>(null);
    const startX = useRef(0);
    const startWidth = useRef(0);

    function onMouseDown(e: MouseEvent) {
      if (!headerRef.current || !resizable) return;
      startX.current = e.clientX;
      startWidth.current = headerRef.current?.getBoundingClientRect().width;

      function onMouseMove(e: MouseEvent) {
        if (!resizable) return;
        const newWidth = Math.max(
          MIN_COLUMN_WIDTH,
          startWidth.current + (e.clientX - startX.current)
        );
        onResize(newWidth);
      }

      function onMouseUp() {
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
      }

      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    }

    return (
      <th
        ref={headerRef}
        scope="col"
        className={`${styles.header} ${className || ""}`}
        style={{left: leftOffset}}
      >
        <FlexElement dimensionX="fill" alignment="leftCenter" className={styles.headerContent}>
          {children}
        </FlexElement>
        {resizable && (
          <div
            onMouseDown={e => onMouseDown(e as unknown as MouseEvent)}
            className={styles.resizer}
          />
        )}
      </th>
    );
  }
);

type RowsProps = {
  formattedColumns: TypeDataColumn[];
  focusedCell: {row: number; column: string} | null;
  handleCellClick: (columnKey: string, index: number) => void;
  data: TypeTableData[];
};

const Rows = memo(({data, formattedColumns, focusedCell, handleCellClick}: RowsProps) => {
  const rowCacheRef = useRef<
    Map<string, {element: JSX.Element; lastFocusedCell: string | null; rowContentString: string}>
  >(new Map());

  const rows: JSX.Element[] = [];

  for (let index = 0; index < data.length; index++) {
    const row = data[index];
    // If a cell is changed, we need to re-render the row
    const rowContentString = formattedColumns
      .map(column => extractTextFromReactNode(row[column.key]?.value))
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
      cached.lastFocusedCell === focusedKey
    ) {
      rows.push(cached.element);
      continue;
    }

    const cells = formattedColumns.map(column => {
      const cellData = row[column.key];

      return (
        <Cell
          key={cellData.id}
          onClick={() => column.selectable !== false && handleCellClick(column.key, index)}
          className={`${column.cellClassName || ""} ${column.fixed ? styles.fixedCell : ""}`}
          leftOffset={column.leftOffset}
          focused={focusedCell?.row === index && focusedCell?.column === column.key}
        >
          {cellData.value}
        </Cell>
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
});

type TypeCell = React.HTMLAttributes<HTMLDivElement> & {focused?: boolean; leftOffset?: number};

const Cell = memo(({children, focused, leftOffset, ...props}: TypeCell) => {
  return (
    <td
      {...props}
      className={`${styles.cell} ${focused ? styles.focusedCell : ""} ${props.className || ""}`}
      style={{left: leftOffset}}
    >
      {children}
    </td>
  );
});

export default memo(Table);
