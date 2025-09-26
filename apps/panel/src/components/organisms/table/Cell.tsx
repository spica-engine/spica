import {memo, useRef, useState, useContext, type ReactNode, useEffect, useMemo} from "react";
import {TableEditContext} from "./TableEditContext";
import {MIN_COLUMN_WIDTH} from "./columnUtils";
import type {Constraints} from "./types";
import styles from "./Table.module.scss";
import {FlexElement, useOnClickOutside} from "oziko-ui-kit";
import type {TypeInputRepresenterError} from "oziko-ui-kit/build/dist/custom-hooks/useInputRepresenter";
import {FIELD_REGISTRY, type FieldKind} from "../../../domain/fields";

const DEFAULT_VALUES: Record<FieldKind, any> = {
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
} as unknown as Record<FieldKind, any>;

export function isValidDate(dateObject: any) {
  return dateObject instanceof Date && !isNaN(dateObject.getTime());
}

const isObjectEffectivelyEmpty = (obj: any): boolean => {
  if (obj == null || typeof obj !== "object") return true;

  return Object.keys(obj).every(
    key =>
      obj[key] === undefined ||
      obj[key] === null ||
      (typeof obj[key] === "object" && isObjectEffectivelyEmpty(obj[key]))
  );
};

function getInitialValue(type: FieldKind, value: any, constraints: Constraints | undefined) {
  const defaultValue = DEFAULT_VALUES[type];
  if (type === "object") {
    return createInitialObject(value, constraints?.properties);
  }

  if (type === "date") {
    const dateValue = isValidDate(new Date(value)) ? new Date(value) : null;
    return dateValue || defaultValue;
  }

  if (type === "location") return value || {lat: 0, lng: 0};

  if (type === "number") return value;

  return value || defaultValue;
}

function createInitialObject(currentValue: any, properties: any | undefined) {
  const initialObject: Record<string, any> = {};

  Object.values(properties || {}).forEach((property: any) => {
    if (property.type === "object") {
      const nestedValue = currentValue?.[property.title];
      initialObject[property.title] = createInitialObject(nestedValue, property.properties);
    } else {
      initialObject[property.title] =
        currentValue?.[property.title] ?? DEFAULT_VALUES[property.type as FieldKind] ?? null;
    }
  });

  return initialObject;
}

const customStyles: Partial<Record<FieldKind, string>> = {
  "multiple selection": styles.multipleSelectionInput,
  multiselect: styles.multipleSelectionInput,
  location: styles.locationInput,
  object: styles.objectInput
} as Partial<Record<FieldKind, string>>;

type CellProps = React.HTMLAttributes<HTMLDivElement> & {
  leftOffset?: number;
  type: FieldKind;
  value: any;
  deletable?: boolean;
};

export const Cell = memo(({value, type, deletable, leftOffset, ...props}: CellProps) => {
  const field = FIELD_REGISTRY[type || "string"];
  return (
    <td {...props} className={`${styles.cell} ${props.className || ""}`} style={{left: leftOffset}}>
      {field?.renderValue?.(value, deletable ?? false)}
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

// AFTER ALL OF THE UPDATES WORKED
// MAKE SURE NO SUBMIT GOES TO BACNKEND IF ERRORS EXIST
// AND AFTER THAT START TO TEST THE CASES WHERE USER SELECTS ANOTHER CELL WHILE SUBMITTING
// OR CLICKS OUTSIDE THE CELL WHILE SUBMITTING
// ALSO ON RELATION FIELDS, EVERYTIME A USER OPENS THE DROPDOWN, IT LOADS THE OPTIONS AGAIN
// NEED TO FIX THAT AS WELL
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
    const inputRef = useRef<HTMLTableCellElement | null>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const savingRef = useRef(false);
    const floatingElementRef = useRef<HTMLDivElement | null>(null);
    const {handleCellSave, registerActiveCell, unregisterActiveCell} = useContext(TableEditContext);

    const [isEditing, setIsEditing] = useState(false);
    const [inputValue, setInputValue] = useState<any>(undefined);
    const [error, setError] = useState<TypeInputRepresenterError | undefined>(undefined);

    const handleDiscardEdit = () => {
      setIsEditing(false);
      setInputValue(getInitialValue(type, value, constraints));
      setError(undefined);
    };

    useOnClickOutside({
      targetElements: [containerRef, inputRef, floatingElementRef],
      onClickOutside: handleDiscardEdit
    });

    const handleClick = (e: React.MouseEvent<HTMLTableCellElement>) => {
      setIsEditing(true);
      try {
        props.onClick?.(e);
      } catch (error) {
        console.error("Error occurred while handling click:", error);
      }
    };

    useEffect(() => {
      // type !== "number" check is to make sure user can clear number input
      // but its a hacky fix, need to find a better way
      if (isEditing && inputValue === undefined && type !== "number") {
        setInputValue(getInitialValue(type, value, constraints));
      }
    }, [isEditing, type, title, value, constraints, inputValue]);

    useEffect(() => {
      if (!isEditing || !inputRef.current) return;
      inputRef.current?.focus();
    }, [isEditing, inputRef]);

    const properties = useMemo(
      () => ({
        ...constraints,
        type,
        title,
        items: constraints?.items,
        properties: constraints.properties,
        enum: constraints?.enum,
        className: constraints?.enum ? styles.enumInput : undefined
      }),
      [type, title, constraints]
    );

    async function handleSave() {
      const validationErrors = field?.validateValue(
        inputValue,
        constraints as any,
        constraints.required
      );

      if (validationErrors && !isObjectEffectivelyEmpty(validationErrors)) {
        setError(validationErrors as TypeInputRepresenterError);
        return;
      }

      let payload: any;
      if (type === "date") {
        if (!inputValue) payload = undefined;
        else if (inputValue instanceof Date && !isNaN(inputValue.getTime()))
          payload = inputValue.toISOString();
        else payload = new Date(inputValue).toISOString();
      } else if (type === "location") {
        const loc = inputValue;
        if (loc?.lat && loc?.lng) payload = {type: "Point", coordinates: [loc.lng, loc.lat]};
        else payload = null;
      } else if (type === "relation") {
        payload = inputValue.value;
      } else {
        payload = inputValue;
      }

      const payloadError = field?.validateValue(payload, constraints as any, constraints.required);
      if (payloadError && !isObjectEffectivelyEmpty(payloadError)) {
        setError({[title]: payloadError} as TypeInputRepresenterError);
        return;
      }

      if (!handleCellSave) {
        setIsEditing(false);
        return;
      }

      try {
        window.document.body.style.cursor = "wait";
        savingRef.current = true;
        const result = await handleCellSave(payload, columnId, rowId);
        if (result) setError(undefined);
        setIsEditing(false);
      } catch (err) {
        const errMsg = {[title]: String((err as any)?.message || err)} as TypeInputRepresenterError;
        setError(errMsg);
      } finally {
        savingRef.current = false;
        window.document.body.style.cursor = "default";
      }
    }

    useEffect(() => {
      if (isEditing) {
        const saveFn = async () => {
          if (savingRef.current) return;
          savingRef.current = true;
          try {
            await handleSave();
          } finally {
            savingRef.current = false;
          }
        };
        registerActiveCell({saveFn, discardFn: handleDiscardEdit, columnId, rowId});
      } else {
        unregisterActiveCell();
      }

      return () => {
        unregisterActiveCell();
      };
    }, [isEditing, inputValue, columnId, rowId]);

    const field = FIELD_REGISTRY[type || "string"];
    const InputComponent = field?.renderInput;

    const className = useMemo(
      () =>
        [
          styles.cell,
          styles.selectableCell,
          focused ? styles.focusedCell : "",
          isEditing && type !== "date" && type !== "location" && type !== "array" ? styles.editingCell : "",
          props.className
        ]
          .filter(Boolean)
          .join(" "),
      [focused, isEditing, props.className, type]
    );

    return (
      <td {...props} className={className} style={{left: leftOffset}} onClick={handleClick}>
        {isEditing && InputComponent ? (
          <div ref={containerRef}>
            <InputComponent
              value={inputValue}
              onChange={setInputValue}
              ref={inputRef}
              properties={properties as any}
              title={title}
              floatingElementRef={floatingElementRef}
              className={styles.cellUpdateInput}
            />
          </div>
        ) : (
          field?.renderValue?.(value, deletable ?? false)
        )}
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
