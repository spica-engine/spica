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
import {
  Button,
  Checkbox,
  FlexElement,
  Icon,
  useInputRepresenter,
  Popover,
  useAdaptivePosition
} from "oziko-ui-kit";
import styles from "./Table.module.scss";
import InfiniteScroll from "react-infinite-scroll-component";
import useScrollDirectionLock from "../../../hooks/useScrollDirectionLock";
import Loader from "../../../components/atoms/loader/Loader";
import type {
  TypeArrayItems,
  TypeInputRepresenterError,
  TypeInputTypeMap,
  TypeProperties
} from "oziko-ui-kit/build/dist/custom-hooks/useInputRepresenter";
import type {Properties} from "src/services/bucketService";

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
  properties?: Properties;
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
  onCellSave?: (value: any, columnName: string, rowId: string) => Promise<any>;
  updateCellDataError?: string | null;
};

type CellEditPayload = {
  ref: RefObject<HTMLElement | null>;
  value: any;
  type: FieldType;
  title: string;
  constraints?: {
    pattern?: string;
    minimum?: number;
    maximum?: number;
    minItems?: number;
    maxItems?: number;
    items?: TypeArrayItems;
    properties?: Properties;
  };
  columnId: string;
  rowId: string;
  setCellValue: (value: any) => void;
};

type CellEditStartEvent = CustomEvent<CellEditPayload>;

const MIN_COLUMN_WIDTH = 140;

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
  tableRef,
  updateCellDataError
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

  const [cellEditPayload, setCellEditPayload] = useState<CellEditPayload | null>(null);

  useEffect(() => {
    const handler = (event: CustomEvent<CellEditPayload>) => setCellEditPayload(event.detail);
    window.addEventListener("cellEditStart", handler as EventListener);
    return () => window.removeEventListener("cellEditStart", handler as EventListener);
  }, []);

  // Calculate total table width to ensure fixed layout works properly
  const totalTableWidth = useMemo(() => {
    return formattedColumns.reduce((total, col) => {
      return total + parseWidth(col.width || "0", 0);
    }, 0);
  }, [formattedColumns]);

  const handleCellSave = useCallback(
    (value: any) =>
      onCellSave?.(
        value,
        (cellEditPayload as CellEditPayload).columnId,
        (cellEditPayload as CellEditPayload).rowId
      ),
    [cellEditPayload, onCellSave]
  ) as (value: any) => Promise<any>;

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
        {onCellSave && cellEditPayload && (
          <EditCellPopover
            value={cellEditPayload.value}
            type={cellEditPayload.type}
            title={cellEditPayload.title}
            constraints={cellEditPayload.constraints}
            onCellSave={handleCellSave}
            setCellValue={cellEditPayload.setCellValue}
            cellRef={cellEditPayload.ref}
            onClose={() => setCellEditPayload(null)}
            updateCellDataError={updateCellDataError ?? null}
          />
        )}
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
          {children as any}
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
});

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
  constraints?: {
    pattern?: string;
    minimum?: number;
    maximum?: number;
    minItems?: number;
    maxItems?: number;
    items?: TypeArrayItems;
    properties?: Properties;
  };
  columnId: string;
  rowId: string;
};

type EditCellPopoverProps = {
  onCellSave: (value: any) => Promise<any>;
  onClose: () => void;
  cellRef: RefObject<HTMLElement | null>;
  type: FieldType;
  value: any;
  title: string;
  constraints?: {
    pattern?: string;
    minimum?: number;
    maximum?: number;
    minItems?: number;
    maxItems?: number;
    items?: TypeArrayItems;
    properties?: Properties;
  };
  updateCellDataError: string | null;
  setCellValue: (value: any) => void;
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

const EditCellPopover = ({
  value,
  type,
  title,
  constraints = {},
  onCellSave,
  onClose,
  cellRef,
  updateCellDataError,
  setCellValue
}: EditCellPopoverProps) => {
  const createInitialObject = () => {
    const initialObject: Record<string, any> = {};

    Object.values(constraints?.properties || {}).forEach(property => {
      if (property.type === "object") {
        initialObject[property.title] = createInitialObject();
      } else {
        initialObject[property.title] = DEFAULT_VALUES[property.type as FieldType] ?? null;
      }
    });

    return initialObject;
  };

  const getInitialValue = () => ({
    value: type === "object" ? createInitialObject() : !value ? DEFAULT_VALUES[type] : value
  });

  const [inputValue, setInputValue] = useState(getInitialValue);
  const [error, setError] = useState<TypeInputRepresenterError>();
  const [isOpen, setIsOpen] = useState(true);

  const handleInputChange = (newValue: any) => {
    setInputValue(newValue);
    setCellValue(newValue.value);
  };

  const properties = useMemo(
    () => ({
      value: {
        type: (type === "relation" ? "string" : type) as keyof TypeInputTypeMap,
        title,
        items: constraints.properties || constraints?.items
      }
    }),
    [type, title, constraints]
  );

  useEffect(() => {
    if (!updateCellDataError) return;
    setError({value: updateCellDataError});
  }, [updateCellDataError]);

  const input = useInputRepresenter({
    properties: properties as TypeProperties,
    value: inputValue,
    onChange: handleInputChange,
    error: error,
    errorClassName: styles.inputError
  });

  const handleClose = () => {
    setIsOpen(false);
    onClose();
  };

  const discardChanges = () => {
    handleInputChange(getInitialValue());
    handleClose();
  };

  const handleSave = async () => {
    const errors = validateInput(inputValue, constraints);
    if (Object.keys(errors).length > 0) {
      setError(errors);
      return;
    }

    const result = await onCellSave(inputValue.value);
    if (result) {
      handleClose();
    }
  };

  useEffect(() => {
    if (!error) return;
    const errors = validateInput(inputValue, constraints);
    if (Object.keys(errors).length === 0 && updateCellDataError === error.value) return;
    setError(errors);
  }, [inputValue.value]);

  const validateInput = useCallback(
    (
      values: {[key: string]: any},
      constraints: {
        pattern?: string;
        minimum?: number;
        maximum?: number;
        minItems?: number;
        maxItems?: number;
        items?: TypeArrayItems;
        properties?: Properties; // innerProperties
      },
      givenProperties?: Properties
    ) => {
      const {pattern, minimum, maximum, minItems, maxItems, items} = constraints;
      const propertiesToUse = givenProperties || properties;
      const errors: TypeInputRepresenterError = {};
      Object.keys(values).forEach(key => {
        const value = values[key];
        const type = (propertiesToUse as Properties)[key]?.type;
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
          const nestedErrors = validateInput(
            value,
            (items || constraints.properties) as typeof constraints,
            constraints.properties
          );
          if (nestedErrors && Object.keys(nestedErrors).length > 0) {
            errors[key] = nestedErrors;
          }
        }
      });

      return errors;
    },
    []
  );

  useEffect(() => {
    handleInputChange(getInitialValue());
  }, [value]);

  useEffect(() => {
    const handleEnter = (event: KeyboardEvent) => {
      if (event.key !== "Enter" || event.shiftKey) return;
      handleSave();
    };
    window.addEventListener("keydown", handleEnter);

    return () => {
      window.removeEventListener("keydown", handleEnter);
    };
  }, [inputValue]);

  const popoverContentRef = useRef<HTMLDivElement | null>(null);
  const {targetPosition, calculatePosition} = useAdaptivePosition({
    containerRef: cellRef,
    targetRef: popoverContentRef,
    initialPlacement: "bottomStart"
  });

  useLayoutEffect(() => {
    if (isOpen) {
      calculatePosition();
    }
  }, [isOpen, calculatePosition]);

  return (
    <Popover
      containerProps={{ref: popoverContentRef}}
      contentProps={{style: targetPosition ?? undefined}}
      open={isOpen}
      onClose={discardChanges}
      content={input}
      portalClassName={styles.inputPopover}
    />
  );
};

const EditableCell = memo(
  ({
    value,
    type,
    deletable,
    title,
    focused,
    leftOffset,
    constraints = {},
    columnId,
    rowId,
    ...props
  }: TypeEditableCell) => {
    const ref = useRef<HTMLTableCellElement | null>(null);
    const [cellValue, setCellValue] = useState(value);
    const handleClick = (e: React.MouseEvent<HTMLTableCellElement>) => {
      props?.onClick?.(e);
      const cellEditStartEvent: CellEditStartEvent = new CustomEvent("cellEditStart", {
        detail: {
          value,
          type,
          title,
          constraints,
          ref,
          columnId,
          rowId,
          setCellValue
        }
      });
      window.dispatchEvent(cellEditStartEvent);
    };

    return (
      <td
        {...props}
        onClick={handleClick}
        className={`${styles.cell} ${styles.selectableCell} ${focused ? styles.focusedCell : ""} ${props.className || ""}`}
        style={{left: leftOffset}}
        ref={ref}
      >
        {renderCell(cellValue, type, deletable)}
      </td>
    );
  }
);

export default memo(Table);
