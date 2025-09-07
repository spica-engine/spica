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
import {Button, Checkbox, FlexElement, Icon, useInputRepresenter, Popover} from "oziko-ui-kit";
import styles from "./Table.module.scss";
import InfiniteScroll from "react-infinite-scroll-component";
import useScrollDirectionLock from "../../../hooks/useScrollDirectionLock";
import Loader from "../../../components/atoms/loader/Loader";
import type {
  TypeArrayItems,
  TypeInputRepresenterError,
  TypeInputTypeMap
} from "oziko-ui-kit/build/dist/custom-hooks/useInputRepresenter";

export type FieldType =
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

type TypeDataColumn = {
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
  type?: FieldType;
  deletable?: boolean;
  title?: string;
  pattern?: string;
  minimum?: number;
  maximum?: number;
  items?: TypeArrayItems;
  minItems?: number;
  maxItems?: number;
};

type TypeTableData = {
  [k: string]: {
    id: string;
    value: any;
  };
};

type TypeTable = {
  columns: TypeDataColumn[];
  data: TypeTableData[];
  className?: string;
  onScrollEnd?: () => void;
  totalDataLength?: number;
  style?: React.CSSProperties;
  tableRef?: RefObject<HTMLElement | null>;
  onCellSave?: (value: any, columnName: string, rowId: string) => void;
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
      return <Checkbox className={styles.checkbox} checked={cellData} />;
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
          <div>{cellData.coordinates}</div>
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
  const defaultColumnWidth = getCalculatedColumnWidth(columns, containerWidth + 10);

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
  onCellSave,
  tableRef
}) => {
  const containerRef = useScrollDirectionLock();
  useImperativeHandle(tableRef, () => containerRef.current as HTMLElement);

  const [formattedColumns, setFormattedColumns] = useState<TypeDataColumn[]>([]);
  const [focusedCell, setFocusedCell] = useState<{column: string; row: number} | null>(null);

  useLayoutEffect(() => {
    if (!containerRef.current) return;
    const containerWidth = containerRef.current?.clientWidth ?? 0;
    // Making it just a little bit smaller than the container to prevent unnecessary horizontal scrolls
    const formattedColumns = getFormattedColumns(containerWidth - 15, columns);
    setFormattedColumns(formattedColumns);
    setFocusedCell(null);
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

  useEffect(() => {
    const handleEnter = (event: KeyboardEvent) => {
      if (event.key !== "Enter" || event.shiftKey) return;
      const cellChangeEvent = new CustomEvent("cellChangeEvent");
      window.dispatchEvent(cellChangeEvent);
    };
    window.addEventListener("keydown", handleEnter);

    return () => {
      window.removeEventListener("keydown", handleEnter);
    };
  }, []);

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
                  onCellSave={onCellSave}
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
  onCellSave?: (value: any, columnName: string, rowId: string) => void;
};

const Rows = memo(
  ({data, formattedColumns, focusedCell, handleCellClick, onCellSave}: RowsProps) => {
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

        console.log("items: ", column.items);
        return column.selectable !== false ? (
          <EditableCell
            key={cellData.id}
            {...props}
            type={column.type ?? "string"}
            focused={focusedCell?.row === index && focusedCell?.column === column.key}
            title={column.title ?? "Value"}
            onCellSave={value => onCellSave?.(value, column.key as string, rowId.split("-")[1])}
            constraints={{
              pattern: column.pattern,
              minimum: column.minimum,
              maximum: column.maximum,
              maxItems: column.maxItems,
              minItems: column.minItems,
              items: column.items
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

type TypeCell = React.HTMLAttributes<HTMLDivElement> & {
  leftOffset?: number;
  type: FieldType;
  value: any;
  deletable?: boolean;
};

const Cell = memo(({value, type, deletable, leftOffset, ...props}: TypeCell) => {
  return (
    <td {...props} className={`${styles.cell} ${props.className || ""}`} style={{left: leftOffset}}>
      {renderCell(value, type, deletable)}
    </td>
  );
});

type TypeEditableCell = TypeCell & {
  focused?: boolean;
  title: string;
  onCellSave?: (value: any) => void;
  constraints?: {
    pattern?: string;
    minimum?: number;
    maximum?: number;
    minItems?: number;
    maxItems?: number;
    items?: TypeArrayItems;
  };
};

const DEFAULT_VALUES: Record<FieldType, any> = {
  string: "",
  number: 0,
  date: null,
  boolean: false,
  textarea: "",
  "multiple selection": [],
  relation: null,
  location: null,
  array: [],
  object: {},
  file: null,
  richtext: ""
};

const EditableCell = memo(
  ({
    value,
    type,
    deletable,
    title,
    focused,
    leftOffset,
    onCellSave,
    constraints = {},
    ...props
  }: TypeEditableCell) => {
    const getInitialValue = () => ({value: !value ? DEFAULT_VALUES[type] : value});

    const [cellValue, setCellValue] = useState(getInitialValue);
    const [error, setError] = useState<TypeInputRepresenterError>();
    const [isEditOpen, setIsEditOpen] = useState(false);
    const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
      props?.onClick?.(e);
      setIsEditOpen(true);
    };

    const input = useInputRepresenter({
      properties: {
        value: {
          type: (type === "relation" ? "string" : type) as keyof TypeInputTypeMap,
          title,
          items: constraints?.items
        }
      },
      value: cellValue,
      onChange: setCellValue,
      error,
      errorClassName: styles.inputError
    });

    const handleClose = () => {
      setIsEditOpen(false);
      setCellValue(getInitialValue());
    };

    useEffect(() => {
      if (!error) return;
      const errors = validateInput(cellValue, constraints);
      setError(errors);
    }, [cellValue.value]);

    const validateInput = (
      values: {[key: string]: any},
      constraints: {
        pattern?: string;
        minimum?: number;
        maximum?: number;
        minItems?: number;
        maxItems?: number;
        items?: TypeArrayItems;
      }
    ) => {
      const {pattern, minimum, maximum, minItems, maxItems, items} = constraints;
      const errors: TypeInputRepresenterError = {};
      Object.keys(values).forEach(key => {
        const value = values[key];
        if (pattern) {
          const isValid = new RegExp(pattern).test(value);
          if (!isValid) {
            errors[key] = `This field does not match the required pattern "${pattern}"`;
            return false;
          }
        } else if (minimum !== undefined && type === "number" && value < minimum) {
          errors[key] = `This field must be at least ${minimum}`;
          return false;
        } else if (maximum !== undefined && type === "number" && value > maximum) {
          errors[key] = `This field must be at most ${maximum}`;
          return false;
        } else if (maxItems !== undefined && type === "array" && value.length > maxItems) {
          errors[key] = `This field must be at most ${maxItems} items`;
          return false;
        } else if (minItems !== undefined && type === "array" && value.length < minItems) {
          errors[key] = `This field must be at least ${minItems} items`;
          return false;
        } else if (type === "object" || type === "array") {
          const nestedErrors = validateInput(value, items as typeof constraints);
          if (nestedErrors && Object.keys(nestedErrors).length > 0) {
            errors[key] = nestedErrors;
          }
        }
      });

      return errors;
    };

    useEffect(() => {
      const eventListener = () => {
        const errors = validateInput(cellValue, constraints);
        if (!isEditOpen || !Object.keys(errors).length) {
          setError(errors);
          return;
        }
        onCellSave?.(cellValue.value);
      };

      window.addEventListener("cellChangeEvent", eventListener);
      return () => window.removeEventListener("cellChangeEvent", eventListener);
    }, [isEditOpen, title, cellValue.value, onCellSave]);

    useEffect(() => {
      setCellValue(getInitialValue());
    }, [value]);

    useEffect(() => {
      setIsEditOpen(Boolean(focused));
    }, [focused]);

    return (
      <td
        {...props}
        onClick={handleClick}
        className={`${styles.cell} ${styles.selectableCell} ${focused ? styles.focusedCell : ""} ${props.className || ""}`}
        style={{left: leftOffset}}
      >
        <Popover
          open={isEditOpen}
          onClose={handleClose}
          content={input}
          portalClassName={styles.inputPopover}
        >
          {renderCell(isEditOpen ? cellValue.value : value, type, deletable)}
        </Popover>
      </td>
    );
  }
);

export default memo(Table);
