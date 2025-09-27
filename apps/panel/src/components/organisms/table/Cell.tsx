import {memo, useRef, useState, useContext, type ReactNode, useEffect, useMemo} from "react";
import {TableEditContext} from "./TableEditContext";
import {MIN_COLUMN_WIDTH} from "./columnUtils";
import type {Constraints} from "./types";
import styles from "./Table.module.scss";
import {FlexElement, useOnClickOutside} from "oziko-ui-kit";
import type {TypeInputRepresenterError} from "oziko-ui-kit/build/dist/custom-hooks/useInputRepresenter";
import {FIELD_REGISTRY, type FieldKind} from "../../../domain/fields";
import type {Property} from "src/services/bucketService";

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
    const field = FIELD_REGISTRY[type || "string"];
    const inputRef = useRef<HTMLTableCellElement | null>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const floatingElementRef = useRef<HTMLDivElement | null>(null);
    const {handleCellSave, registerActiveCell, unregisterActiveCell} = useContext(TableEditContext);

    const [isEditing, setIsEditing] = useState(false);
    const [inputValue, setInputValue] = useState<any>(undefined);
    const [error, setError] = useState<TypeInputRepresenterError | undefined>(undefined);
    const [isSaving, setIsSaving] = useState(false);

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
    ) as Property;

    const handleDiscardEdit = () => {
      // if we dont, then other cells handleDiscardEdit will be called too,
      // we should instead not render this component at all when not editing
      if (!isEditing) return;
      const newValue = field?.getFormattedValue?.(value, properties);
      console.log(1, newValue, value);
      setInputValue(newValue);
      setIsEditing(false);
      setError(undefined);
    };

    useOnClickOutside({
      targetElements: [containerRef, inputRef, floatingElementRef],
      onClickOutside: handleDiscardEdit
    });

    const handleClick = (e: React.MouseEvent<HTMLTableCellElement>) => {
      setIsEditing(true);

      if (type === "color") {
        // Open the color input’s native picker on first render.
        // We use requestAnimationFrame to ensure the input is fully rendered
        // and has layout before triggering .click(), so the popup appears
        // anchored correctly instead of at the top-left corner.
        requestAnimationFrame(() => {
          inputRef.current?.click();
        });
      }

      try {
        props.onClick?.(e);
      } catch (error) {
        console.error("Error occurred while handling click:", error);
      }
    };

    useEffect(() => {
      if (!isEditing || !inputRef.current) return;
      inputRef.current?.focus();
    }, [isEditing, inputRef]);

    async function handleSave() {
      if (isSaving) return;
      setIsSaving(true);

      const validationErrors = field?.validateValue(
        inputValue,
        constraints as any,
        constraints.required
      );

      if (validationErrors && !isObjectEffectivelyEmpty(validationErrors)) {
        setError(validationErrors as TypeInputRepresenterError);
        setIsSaving(false);
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
        setIsSaving(false);
        return;
      }

      if (!handleCellSave) {
        setIsEditing(false);
        setIsSaving(false);
        return;
      }

      try {
        window.document.body.style.cursor = "wait";
        const result = await handleCellSave(payload, columnId, rowId);
        if (result) setError(undefined);
        setIsEditing(false);
      } catch (err) {
        const errMsg = {[title]: String((err as any)?.message || err)} as TypeInputRepresenterError;
        setError(errMsg);
      } finally {
        setIsSaving(false);
        window.document.body.style.cursor = "default";
      }
    }

    useEffect(() => {
      if (isEditing) {
        const saveFn = async () => {
          if (isSaving) return;
          await handleSave();
        };
        registerActiveCell({saveFn, discardFn: handleDiscardEdit, columnId, rowId});
      } else {
        unregisterActiveCell();
      }

      return () => {
        unregisterActiveCell();
      };
    }, [isEditing, inputValue, columnId, rowId, isSaving]);

    const InputComponent = field?.renderInput;

    const className = useMemo(
      () =>
        [
          styles.cell,
          styles.selectableCell,
          focused ? styles.focusedCell : "",
          isEditing && type !== "date" && type !== "location" && type !== "array"
            ? styles.editingCell
            : "",
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
              onChange={value => {
                console.log(3, value);
                setInputValue(value);
              }}
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
