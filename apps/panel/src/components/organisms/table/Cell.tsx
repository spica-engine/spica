import {memo, useRef, useState, type ReactNode, type RefObject} from "react";
import type {TypeArrayItems} from "src/hooks/useInputRepresenter";
import type {Properties} from "src/services/bucketService";
import {MIN_COLUMN_WIDTH} from "./columnUtils";
import {renderCell} from "./TableBody";
import type {FieldType} from "./types";
import styles from "./Table.module.scss";
import {FlexElement} from "oziko-ui-kit";

type CellEditStartEvent = CustomEvent<CellEditPayload>;

export type CellEditPayload = {
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

export const CELL_EDIT_START_EVENT_NAME = "cellEditStart";

type TypeCell = React.HTMLAttributes<HTMLDivElement> & {
  leftOffset?: number;
  type: FieldType;
  value: any;
  deletable?: boolean;
};

export const Cell = memo(({value, type, deletable, leftOffset, ...props}: TypeCell) => {
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
  }: TypeEditableCell) => {
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
