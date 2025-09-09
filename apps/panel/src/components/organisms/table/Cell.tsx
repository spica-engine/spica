import {memo, useRef, useState, type JSX, type ReactNode, type RefObject} from "react";
import {MIN_COLUMN_WIDTH} from "./columnUtils";
import type {Constraints, FieldType} from "./types";
import styles from "./Table.module.scss";
import {FlexElement} from "oziko-ui-kit";
import {Button, Icon, Checkbox} from "oziko-ui-kit";
import {isValidDate} from "./EditCellPopover";

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
          {deletable && cellData && (
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

type CellEditStartEvent = CustomEvent<CellEditPayload>;

export type CellEditPayload = {
  ref: RefObject<HTMLElement | null>;
  value: any;
  type: FieldType;
  title: string;
  constraints?: Constraints;
  columnId: string;
  rowId: string;
  setCellValue: (value: any) => void;
};

export const CELL_EDIT_START_EVENT_NAME = "cellEditStart";

type CellProps = React.HTMLAttributes<HTMLDivElement> & {
  leftOffset?: number;
  type: FieldType;
  value: any;
  deletable?: boolean;
};

export const Cell = memo(({value, type, deletable, leftOffset, ...props}: CellProps) => {
  return (
    <td {...props} className={`${styles.cell} ${props.className || ""}`} style={{left: leftOffset}}>
      {renderCell(value, type, deletable)}
    </td>
  );
});

type EditableCellProps = CellProps & {
  focused?: boolean;
  title: string;
  constraints?: Constraints;
  columnId: string;
  rowId: string;
};

export const EditableCell = memo(
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
  }: EditableCellProps) => {
    const ref = useRef<HTMLTableCellElement | null>(null);
    const [cellValue, setCellValue] = useState(value);
    const handleClick = (e: React.MouseEvent<HTMLTableCellElement>) => {
      props?.onClick?.(e);
      const cellEditStartEvent: CellEditStartEvent = new CustomEvent(CELL_EDIT_START_EVENT_NAME, {
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

type HeaderCellProps = {
  className?: string;
  children: ReactNode;
  onResize: (newWidth: number) => void;
  resizable?: boolean;
  leftOffset?: number;
};

export const HeaderCell = memo(
  ({className, children, onResize, resizable, leftOffset}: HeaderCellProps) => {
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
