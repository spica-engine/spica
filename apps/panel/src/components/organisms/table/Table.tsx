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
  | "richtext"
  | "multiselect"
  | "color";

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

function isValidDate(dateObject: any) {
  return dateObject instanceof Date && !isNaN(dateObject.getTime());
}

// TODO: Refactor this function to render more appropriate UI elements for each field type.
// Many field types are currently using the generic `renderDefault()`.
function renderCell(cellData: any, type?: FieldType, deletable?: boolean) {
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

const isObjectEffectivelyEmpty = (obj: any): boolean => {
  if (obj == null || typeof obj !== "object") return true;

  return Object.keys(obj).every(
    key =>
      obj[key] === undefined ||
      obj[key] === null ||
      (typeof obj[key] === "object" && isObjectEffectivelyEmpty(obj[key]))
  );
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
  date: "",
  boolean: false,
  textarea: "",
  "multiple selection": [],
  multiselect: [],
  relation: null,
  location: {lat: 36.966667, lng: 30.666667},
  array: [],
  object: {},
  file: null,
  richtext: "",
  color: "#000000"
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
  const createInitialObject = (currentValue: any, properties: Properties | undefined) => {
    const initialObject: Record<string, any> = {};

    Object.values(properties || {}).forEach(property => {
      if (property.type === "object") {
        // Pass the nested value to the recursive call
        const nestedValue = currentValue?.[property.title];
        initialObject[property.title] = createInitialObject(nestedValue, property.properties);
      } else {
        // Use the current value if it exists, otherwise fall back to defaults
        initialObject[property.title] =
          currentValue?.[property.title] ?? DEFAULT_VALUES[property.type as FieldType] ?? null;
      }
    });

    return initialObject;
  };

  const getValueForType = (fallbackToDefaults: boolean = true) => {
    const defaultValue = DEFAULT_VALUES[type];

    if (type === "object") {
      return fallbackToDefaults
        ? {value: createInitialObject(value, constraints.properties)}
        : {value};
    }

    if (type === "date") {
      const dateValue = isValidDate(new Date(value)) ? new Date(value) : null;
      return {
        value: dateValue || (fallbackToDefaults ? defaultValue : null)
      };
    }

    if (type === "color") {
      return {
        value: value || (fallbackToDefaults ? defaultValue : "")
      };
    }

    if (type === "location") {
      return {value: value || {lat: 0, lng: 0}};
    }

    return fallbackToDefaults ? {value: value ?? defaultValue} : (value ?? defaultValue);
  };

  const getInitialValue = () => getValueForType(true);

  const getEmptyValue = () => getValueForType(false);

  const [inputValue, setInputValue] = useState(getInitialValue);
  const [error, setError] = useState<TypeInputRepresenterError>();
  const [isOpen, setIsOpen] = useState(true);

  console.log("error", error);
  const handleInputChange = (newValue: any) => {
    setInputValue(newValue);

    let transformedValue;

    if (type === "date") {
      transformedValue = newValue?.value?.toString();
    } else if (type === "location" && newValue?.value?.lat && newValue?.value?.lng) {
      transformedValue = {
        type: "Point",
        coordinates: [newValue?.value?.lat, newValue?.value?.lng]
      };
    } else {
      transformedValue = newValue?.value;
    }

    setCellValue(transformedValue);
  };

  const properties = useMemo(
    () => ({
      value: {
        type,
        title,
        items: constraints?.items,
        properties: constraints.properties
      }
    }),
    [type, title, constraints]
  );

  useEffect(() => {
    if (!updateCellDataError) return;
    setError({value: updateCellDataError});
  }, [updateCellDataError]);

  const customStyles: Partial<Record<FieldType, string>> = {
    "multiple selection": styles.multipleSelectionInput,
    multiselect: styles.multipleSelectionInput,
    location: styles.locationInput,
    object: styles.objectInput
  };

  const input = useInputRepresenter({
    properties: properties as TypeProperties,
    value: inputValue,
    onChange: handleInputChange,
    error: error, //{value: {user: {email: "god damn"}}},
    errorClassName: styles.inputError,
    containerClassName: customStyles[type]
  });

  const handleClose = () => {
    setIsOpen(false);
    onClose();
  };

  const discardChanges = () => {
    handleInputChange(getEmptyValue());
    handleClose();
  };

  const handleSave = async () => {
    const errors = validateInput(inputValue, constraints);
    if (!isObjectEffectivelyEmpty(errors)) {
      setError(errors);
      return;
    }

    const payload =
      type === "location"
        ? {type: "Point", coordinates: [inputValue?.value?.lat, inputValue?.value?.lng]}
        : inputValue?.value;

    const result = await onCellSave(payload);
    if (result) {
      handleClose();
    }
  };

  const validateInput = useCallback(
    (
      inputValue: {[key: string]: any},
      constraints: {
        pattern?: string;
        minimum?: number;
        maximum?: number;
        minItems?: number;
        maxItems?: number;
        items?: TypeArrayItems;
        properties?: Properties;
      }
    ): TypeInputRepresenterError => {
      if (!constraints) return {};
      // Get the actual value from the input structure
      const actualValue = inputValue?.value;
      // If we have properties constraint, validate the object structure
      if (constraints.properties && type === "object") {
        const errors = validateObjectProperties(actualValue, constraints.properties);
        return {value: errors};
      }

      // For non-object types, validate the direct value
      return validateSingleValue(actualValue, constraints, "value");
    },
    []
  );

  useEffect(() => {
    console.log(1);
    if (!error || isObjectEffectivelyEmpty(error)) return;
    const errors = validateInput(inputValue, constraints);
    if (Object.keys(errors).length === 0 && updateCellDataError === error.value) return;
    setError(errors);
  }, [inputValue, JSON.stringify(error), updateCellDataError]);

  const validateObjectProperties = (
    obj: any,
    properties: Properties,
    debugname?: string
  ): TypeInputRepresenterError => {
    const errors: TypeInputRepresenterError = {};

    Object.entries(properties).forEach(([key, propertySchema]) => {
      const value = obj[key];
      const fieldErrors = validateSingleValue(value, propertySchema, key, debugname + "." + key);
      errors[key] = fieldErrors[key] || fieldErrors;
      if (Object.keys(fieldErrors).length === 0) {
        delete errors[key];
      }
    });

    return errors;
  };

  // Helper function to validate a single value
  const validateSingleValue = (
    value: any,
    schema: any,
    fieldKey: string,
    debugname?: string
  ): TypeInputRepresenterError => {
    const errors: TypeInputRepresenterError = {};

    if (!schema) return errors;

    const {type, pattern, minimum, maximum, minItems, maxItems, properties, items, required} =
      schema;

    // Check required fields
    if (
      required &&
      required.includes(fieldKey) &&
      (value === undefined || value === null || value === "")
    ) {
      errors[fieldKey] = `This field is required`;
      return errors;
    }

    // Skip validation if value is empty and not required
    if (value === undefined || value === null || value === "") {
      return errors;
    }

    // Type-specific validation
    switch (type) {
      case "string":
        if (pattern && typeof value === "string") {
          const isValid = new RegExp(pattern).test(value);
          if (!isValid) {
            errors[fieldKey] = `This field does not match the required pattern "${pattern}"`;
          }
        }
        break;

      case "number":
        if (minimum !== undefined && value < minimum) {
          errors[fieldKey] = `This field must be at least ${minimum}`;
        }
        if (maximum !== undefined && value > maximum) {
          errors[fieldKey] = `This field must be at most ${maximum}`;
        }
        break;

      case "array":
        if (minItems !== undefined && value.length < minItems) {
          errors[fieldKey] = `This field must have at least ${minItems} items`;
        }
        if (maxItems !== undefined && value.length > maxItems) {
          errors[fieldKey] = `This field must have at most ${maxItems} items`;
        }
        //console.log("debugname", debugname);
        // Validate array items if items schema is provided
        console.log("schema", schema);
        if (items) {
          (value as never[]).forEach((item, index) => {
            const itemErrors = validateSingleValue(item, items, `${fieldKey}[${index}]`);
            Object.assign(errors, itemErrors);
          });
        }
        break;

      case "object":
        if (value && typeof value === "object" && properties) {
          const nestedErrors = validateObjectProperties(value, properties, debugname);
          Object.assign(errors, nestedErrors);
        }
        break;
    }

    return errors;
  };

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
      contentProps={{
        style: targetPosition ?? undefined
        //? {...targetPosition, left: (targetPosition?.left ?? 0) - 300}
        //: undefined
      }}
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
          setCellValue: val => {
            // Force a new reference for arrays and objects
            if (Array.isArray(val)) {
              setCellValue([...val]);
            } else if (val && typeof val === "object") {
              setCellValue({...val});
            } else {
              setCellValue(val);
            }
          }
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
