import {memo, useRef, useState, useContext, type ReactNode, useEffect, useMemo, useId} from "react";
import {TableEditContext} from "./TableEditContext";
import {MIN_COLUMN_WIDTH} from "./columnUtils";
import type {Constraints} from "./types";
import styles from "./Table.module.scss";
import {FlexElement, useOnClickOutside} from "oziko-ui-kit";
import type {TypeInputRepresenterError} from "oziko-ui-kit/build/dist/custom-hooks/useInputRepresenter";
import {FIELD_REGISTRY, type FieldKind} from "../../../domain/fields";
import type {Properties, Property} from "src/services/bucketService";
import type {FieldDefinition, FormError} from "src/domain/fields/types";
import useLocalStorage from "../../../hooks/useLocalStorage";
import {useRelationInputHandlers} from "../../../hooks/useRelationInputHandlers";

export function isValidDate(dateObject: any) {
  return dateObject instanceof Date && !isNaN(dateObject.getTime());
}

const isObjectEffectivelyEmpty = (obj: any): boolean => {
  if (obj == null || typeof obj !== "object") return true;

  return Object.keys(obj).every(key => {
    return (
      obj[key] === undefined ||
      obj[key] === null ||
      (typeof obj[key] === "object" && isObjectEffectivelyEmpty(obj[key]))
    );
  });
};

const findFirstErrorId = (errors: FormError, formattedProperties: Properties): string | null => {
  for (const [key, error] of Object.entries(errors ?? {})) {
    const property = formattedProperties[key];

    if (typeof error === "string" && property?.id) {
      return property.id;
    } else if (typeof error === "object" && property?.properties) {
      const nestedId = findFirstErrorId(error, property.properties);
      if (nestedId) return nestedId;
    }
  }
  return null;
};

type CellProps = React.HTMLAttributes<HTMLDivElement> & {
  leftOffset?: number;
  type: FieldKind;
  value: any;
  deletable?: boolean;
  editable?: boolean;
  focused?: boolean;
  title: string;
  columnId: string;
  rowId: string;
  constraints?: Constraints;
};

type CollectedRelation = {bucketId: string; value: any};

function collectBucketIds(Properties: Properties, cellValue: any): CollectedRelation[] {
  const collected: CollectedRelation[] = [];

  function traverse(property: Property, value: any) {
    if (!property || typeof property !== "object") return;
    if (property.type === "relation") {
      const relationValue = value?.[property.title as any];
      collected.push({bucketId: property.bucketId as string, value: relationValue});
    }

    if (property.type !== "relation" && (property.type === "object" || property.type === "array")) {
      for (const prop of Object.values(property.properties || {})) {
        const childValue = value?.[(prop as Property).title];
        if (prop && typeof childValue === "object") traverse(prop as Property, childValue);
      }
    }
  }
  for (const prop of Object.values(Properties || {})) {
    traverse(prop, cellValue);
  }
  return collected;
}

export const Cell = memo(
  ({
    value,
    type,
    deletable,
    leftOffset,
    editable,
    focused,
    title,
    columnId,
    rowId,
    constraints,
    ...props
  }: CellProps) => {
    const field = FIELD_REGISTRY[type || "string"] as FieldDefinition;
    const [isEditing, setIsEditing] = useState(false);
    const [token] = useLocalStorage("token", "");
    const {getOptionsMap, loadMoreOptionsMap, searchOptionsMap, relationStates, ensureHandlers} =
      useRelationInputHandlers(token);

    const id = useId();

    const bucketIds = useMemo<CollectedRelation[]>(
      () =>
        type === "object" ? collectBucketIds(constraints?.properties as Properties, value) : [],
      [type, constraints?.properties, value]
    );

    useEffect(() => {
      for (const {bucketId, value: relationValue} of bucketIds) {
        ensureHandlers(bucketId, bucketId, relationValue);
      }

      if (type === "relation" && constraints?.bucketId) {
        ensureHandlers(constraints.bucketId, id);
      }
    }, [type, constraints?.properties, constraints?.bucketId, ensureHandlers, id]);

    const properties = useMemo<Property | undefined>(() => {
      if (relationStates[id] && type === "relation") {
        return field.buildValueProperty?.(constraints as Property, {
          getOptions: getOptionsMap.current[id],
          loadMoreOptions: loadMoreOptionsMap.current[id],
          searchOptions: searchOptionsMap.current[id],
          relationState: relationStates[id]
        }) as Property;
      } else if (
        type === "object" &&
        Object.keys(relationStates).length &&
        Object.values(relationStates).every(i => i.stateInitialized)
      ) {
        return field.buildValueProperty?.(constraints as Property, {
          getOptionsMap: getOptionsMap.current,
          loadMoreOptionsMap: loadMoreOptionsMap.current,
          searchOptionsMap: searchOptionsMap.current,
          relationStates
        }) as Property;
      } else {
        return field.buildValueProperty?.(constraints as Property) as Property;
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [relationStates, constraints]);

    const [cellValue, setCellValue] = useState();
    const isValueInitialized = useRef(false);
    useEffect(() => {
      if (!properties || isValueInitialized.current) return;
      if (type === "relation" && !relationStates[id]) return;
      if (
        type === "object" &&
        bucketIds.length &&
        (Object.keys(relationStates).length === 0 ||
          !Object.values(relationStates).every(i => i.stateInitialized))
      )
        return;

      const formatted = field.getFormattedValue(value, properties as Property);
      setCellValue(formatted);
      isValueInitialized.current = true;
    }, [properties]);

    const handleStartEditing = () => {
      if (!editable || !properties) return;
      setIsEditing(true);
    };

    function handleStopEditing(newValue?: any) {
      setIsEditing(false);
      const notFormattedValue = arguments.length ? newValue : value;
      const formattedValue = field?.getFormattedValue(notFormattedValue, properties as Property);
      // Some of the inputs (like richtext) trigger their onChange on unmount,
      // This ensures the latest value is always rendered when the cell exits edit mode without saving.
      setTimeout(() => setCellValue(formattedValue), 0);
    }
    return isEditing && properties ? (
      <EditableCell
        {...props}
        type={type}
        focused={focused}
        title={title}
        columnId={columnId!}
        rowId={rowId!}
        constraints={constraints}
        value={cellValue}
        onStopEdit={handleStopEditing}
        properties={properties}
        setValue={setCellValue}
      />
    ) : (
      <td
        {...props}
        className={`${styles.cell} ${props.className || ""}`}
        style={{left: leftOffset}}
        onClick={handleStartEditing}
      >
        {field?.renderValue?.(cellValue, deletable ?? false)}
      </td>
    );
  }
);

type EditableCellProps = CellProps & {
  onStopEdit: (newValue?: any) => void;
  setValue: (value: any) => void;
  properties: Property;
};

const EditableCell = memo(
  ({
    value,
    setValue,
    type,
    deletable,
    title,
    focused,
    leftOffset,
    constraints = {},
    properties,
    columnId,
    rowId,
    onStopEdit,
    ...props
  }: EditableCellProps) => {
    const field = FIELD_REGISTRY[type || "string"] as FieldDefinition;
    const inputRef = useRef<HTMLTableCellElement | null>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const floatingElementRef = useRef<HTMLDivElement | null>(null);
    const {onCellSave, registerActiveCell, unregisterActiveCell} = useContext(TableEditContext);
    const [error, setError] = useState<TypeInputRepresenterError | undefined>(undefined);
    const [isSaving, setIsSaving] = useState(false);

    const handleDiscardEdit = () => {
      if (isSaving) return;
      setError(undefined);
      onStopEdit();
    };

    useOnClickOutside({
      targetElements: [containerRef, inputRef, floatingElementRef],
      onClickOutside: handleDiscardEdit
    });

    const handleClick = (e: React.MouseEvent<HTMLTableCellElement>) => {
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
      if (!inputRef.current) return;
      inputRef.current?.focus();
    }, [inputRef]);

    useEffect(() => {
      if ((type !== "object" && type !== "array") || !error) return;
      handleValidate();
    }, [value]);

    const handleValidate = () => {
      const validationErrors = field?.validateValue(
        value,
        constraints as Property,
        constraints.required
      );

      if (
        (validationErrors &&
          typeof validationErrors === "object" &&
          !isObjectEffectivelyEmpty(validationErrors)) ||
        typeof validationErrors === "string"
      ) {
        const firstErrorId = findFirstErrorId(validationErrors, properties.properties);
        setError(validationErrors as TypeInputRepresenterError);
        setIsSaving(false);
        if (firstErrorId) {
          const errorElement = document.getElementById(firstErrorId);
          errorElement?.scrollIntoView({behavior: "smooth", block: "center"});
        } else {
          containerRef.current?.scrollTo({top: 0, behavior: "smooth"});
        }
        return false;
      }

      const formattedValue = field.getFormattedValue(value, properties);
      let payload;
      if (type === "relation" && properties.relationType === "onetomany") {
        payload = Array.isArray(formattedValue)
          ? formattedValue.map(i => i.value)
          : [formattedValue?.value];
      } else payload = typeof formattedValue === "string" ? formattedValue : formattedValue.value;

      const payloadError = field?.validateValue(
        payload,
        constraints as Property,
        constraints.required
      );

      if (payloadError && !isObjectEffectivelyEmpty(payloadError)) {
        setError({[title]: payloadError} as TypeInputRepresenterError);
        setIsSaving(false);
        return false;
      }
      setError(undefined);
      return {payload, formattedValue};
    };

    async function handleSave() {
      if (isSaving) return;
      const payloadResult = handleValidate();
      if (!payloadResult) return;
      const {payload, formattedValue} = payloadResult;
      setIsSaving(true);
      setError(undefined);

      if (!onCellSave) {
        onStopEdit();
        setIsSaving(false);
        return;
      }

      try {
        window.document.body.style.cursor = "wait";
        const result = await onCellSave(payload, columnId, rowId, formattedValue);
        if (result) setError(undefined);
      } catch (err) {
        const errMsg = {
          [title]: String((err as Error)?.message || err)
        } as TypeInputRepresenterError;
        setError(errMsg);
      } finally {
        setIsSaving(false);
        onStopEdit(value);
        window.document.body.style.cursor = "default";
      }
    }

    useEffect(() => {
      const onKey = (e: KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
          handleSave();
        } else if (e.key === "Escape") {
          handleDiscardEdit();
        }
      };

      window.addEventListener("keydown", onKey);
      return () => window.removeEventListener("keydown", onKey);
    }, [handleSave]);

    useEffect(() => {
      registerActiveCell();
      return () => {
        unregisterActiveCell();
      };
    }, []);

    const InputComponent = field?.renderInput;

    const className = useMemo(
      () =>
        [
          styles.cell,
          styles.selectableCell,
          focused ? styles.focusedCell : "",
          type !== "date" && type !== "location" && type !== "array" ? styles.editingCell : "",
          props.className
        ]
          .filter(Boolean)
          .join(" "),
      [focused, props.className, type]
    );

    return (
      <td {...props} className={className} style={{left: leftOffset}} onClick={handleClick}>
        <div ref={containerRef}>
          <InputComponent
            value={value}
            onChange={setValue}
            ref={inputRef}
            properties={properties}
            title={title}
            floatingElementRef={floatingElementRef}
            className={styles.cellUpdateInput}
            error={error}
          />
        </div>
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
