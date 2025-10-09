import {memo, useRef, useState, useContext, type ReactNode, useEffect, useMemo, useId} from "react";
import {TableEditContext} from "./TableEditContext";
import {
  MIN_COLUMN_WIDTH,
  collectBucketIds,
  findFirstErrorId,
  isObjectEffectivelyEmpty
} from "./TableUtils";
import type {Constraints} from "./TableTypes";
import styles from "./Table.module.scss";
import {FlexElement, useOnClickOutside} from "oziko-ui-kit";
import type {TypeInputRepresenterError} from "oziko-ui-kit/dist/custom-hooks/useInputRepresenter";
import {FIELD_REGISTRY, FieldKind} from "../../../domain/fields";
import type {Properties, Property} from "src/services/bucketService";
import type {FieldDefinition, FormError} from "src/domain/fields/types";
import useLocalStorage from "../../../hooks/useLocalStorage";
import {useRelationInputHandlers} from "../../../hooks/useRelationInputHandlers";
import type {CollectedRelation} from "./TableTypes";

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

    const {onCellSave} = useContext(TableEditContext);

    const id = useId();

    const bucketIds = useMemo<CollectedRelation[]>(
      () =>
        type === FieldKind.Object || type === FieldKind.Array
          ? collectBucketIds(
              (constraints?.properties ?? constraints?.items?.properties) as Properties,
              value
            )
          : [],
      [type, constraints?.properties, value]
    );

    useEffect(() => {
      for (const {bucketId, value: relationValue} of bucketIds) {
        ensureHandlers(bucketId, bucketId, relationValue);
      }

      if (type === FieldKind.Relation && constraints?.bucketId) {
        ensureHandlers(constraints.bucketId, id);
      }
    }, [type, constraints?.properties, constraints?.bucketId, ensureHandlers, id]);

    let properties: Property | undefined;
    const isRelationField = type === FieldKind.Relation;
    const isObjectField = type === FieldKind.Object;
    const isArrayField = type === FieldKind.Array;

    const relationExists = bucketIds.length > 0 || isRelationField;
    const isRelationReady =
      !!relationStates[id] ||
      (Object.keys(relationStates).length > 0 &&
        Object.values(relationStates).every(i => i.stateInitialized));

    if (!relationExists) {
      properties = field.buildValueProperty?.(constraints as Property) as Property;
    } else if (isRelationField && isRelationReady) {
      properties = field.buildValueProperty?.(constraints as Property, {
        getOptions: getOptionsMap.current[id],
        loadMoreOptions: loadMoreOptionsMap.current[id],
        searchOptions: searchOptionsMap.current[id],
        relationState: relationStates[id]
      }) as Property;
    } else if (isObjectField && isRelationReady) {
      properties = field.buildValueProperty?.(constraints as Property, {
        getOptionsMap: getOptionsMap.current,
        loadMoreOptionsMap: loadMoreOptionsMap.current,
        searchOptionsMap: searchOptionsMap.current,
        relationStates
      }) as Property;
    } else if (isArrayField && isRelationReady) {
      properties = field.buildValueProperty?.(constraints as Property, {
        getOptionsMap: getOptionsMap.current,
        loadMoreOptionsMap: loadMoreOptionsMap.current,
        searchOptionsMap: searchOptionsMap.current,
        relationStates
      }) as Property;
    }

    const [cellValue, setCellValue] = useState();
    const isValueInitialized = useRef(false);
    useEffect(() => {
      const propertiesReady = !!properties;
      const valueAlreadyInitialized = isValueInitialized.current;
      const relationStateReady = type === FieldKind.Relation ? !!relationStates[id] : true;
      const objectTypeNeedsRelationStates =
        type === FieldKind.Object &&
        bucketIds.length > 0 &&
        (Object.keys(relationStates).length === 0 ||
          !Object.values(relationStates).every(i => i.stateInitialized));

      if (
        !propertiesReady ||
        valueAlreadyInitialized ||
        !relationStateReady ||
        objectTypeNeedsRelationStates
      )
        return;

      const formatted = field.getDisplayValue(value, properties as Property);
      setCellValue(formatted);
      isValueInitialized.current = true;
    }, [properties, relationStates]);

    const handleStartEditing = (e: React.MouseEvent<HTMLTableCellElement>) => {
      if (!editable || !properties) return;
      setIsEditing(true);
      props.onClick?.(e);
    };

    function handleStopEditing(newValue?: any) {
      setIsEditing(false);
      const notFormattedValue = arguments.length ? newValue : value;
      const formattedValue = field?.getDisplayValue(notFormattedValue, properties as Property);
      setCellValue(formattedValue);
    }

    const handleSave = async (newValue: any) => {
      if (!onCellSave) return;
      const formattedValue = field.getSaveReadyValue(newValue, properties as Property);
      try {
        return await onCellSave(formattedValue, columnId, rowId);
      } catch (error) {
        setCellValue(value);
        throw error;
      }
    };

    return isEditing && properties ? (
      <EditableCell
        {...props}
        type={type}
        focused={focused}
        title={title}
        constraints={constraints}
        value={cellValue}
        onStopEdit={handleStopEditing}
        properties={properties}
        setValue={setCellValue}
        onCellSave={handleSave}
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

type EditableCellProps = Omit<CellProps, "columnId" | "rowId"> & {
  onStopEdit: (newValue?: any) => void;
  setValue: (value: any) => void;
  properties: Property;
  onCellSave?: (newValue: any) => Promise<FormError | void>;
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
    onStopEdit,
    onCellSave,
    ...props
  }: EditableCellProps) => {
    const field = FIELD_REGISTRY[type || "string"] as FieldDefinition;
    const inputRef = useRef<HTMLTableCellElement | null>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const floatingElementRef = useRef<HTMLDivElement | null>(null);
    const {registerActiveCell, unregisterActiveCell} = useContext(TableEditContext);
    const [error, setError] = useState<TypeInputRepresenterError | undefined>(undefined);
    const [isSaving, setIsSaving] = useState(false);

    const handleDiscardEdit = () => {
      if (isSaving) return;
      setError(undefined);
      onStopEdit();
    };

    useOnClickOutside({
      targetElements: [containerRef, inputRef, floatingElementRef],
      onClickOutside: ["object", "array", "location", "richtext"].includes(type)
        ? () => {}
        : handleDiscardEdit
    });

    const handleClick = (e: React.MouseEvent<HTMLTableCellElement>) => {
      if (type === FieldKind.Color) {
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
      if (![FieldKind.Object, FieldKind.Array].includes(type) || !error) return;
      const formattedValue = field.getDisplayValue(value, properties);
      handleValidate(formattedValue);
    }, [value]);

    const handleValidate = (formattedValue: any) => {
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

      const payloadError = field?.validateValue(
        formattedValue,
        constraints as Property,
        constraints.required
      );

      if (payloadError && !isObjectEffectivelyEmpty(payloadError)) {
        setError({[title]: payloadError} as TypeInputRepresenterError);
        setIsSaving(false);
        return false;
      }
      setError(undefined);
      return true;
    };

    async function handleSave() {
      if (isSaving) return;
      const formattedValue = field.getSaveReadyValue(value, properties);
      const isValid = handleValidate(formattedValue);
      if (!isValid) return;
      setIsSaving(true);
      setError(undefined);

      if (!onCellSave) {
        onStopEdit();
        setIsSaving(false);
        return;
      }

      try {
        window.document.body.style.cursor = "wait";
        const result = await onCellSave(formattedValue);
        if (result) setError(undefined);
        onStopEdit(value);
      } catch (err) {
        const errMsg = {
          [title]: String((err as Error)?.message || err)
        } as TypeInputRepresenterError;
        setError(errMsg);
        onStopEdit();
      } finally {
        setIsSaving(false);
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

    const className = useMemo(() => {
      const classes = [styles.cell, styles.selectableCell, props.className];

      if (focused) {
        classes.push(styles.focusedCell);
      }

      const noPadding =
        type !== FieldKind.Date && type !== FieldKind.Location && type !== FieldKind.Array;

      if (noPadding) {
        classes.push(styles.noPadding);
      }

      return classes.filter(Boolean).join(" ");
    }, [focused, props.className, type]);

    const containerClassName = useMemo(() => {
      const classes = [];

      const shouldUseFlex = ![FieldKind.Boolean, FieldKind.Array].includes(type);
      const shouldAddPadding =
        properties.enum ||
        [FieldKind.Textarea, FieldKind.Multiselect, FieldKind.Relation].includes(type);
      const shouldLimitWidth =
        !properties.enum &&
        ![FieldKind.Date, FieldKind.Textarea, FieldKind.Relation].includes(type);

      if (shouldUseFlex) {
        classes.push(styles.cellUpdateContainerFlex);
      }

      if (shouldAddPadding) {
        classes.push(styles.cellUpdateContainerPadding);
      }

      if (shouldLimitWidth) {
        classes.push(styles.widthMaxContent);
      }

      return classes.filter(Boolean).join(" ");
    }, [type, properties]);

    return (
      <td {...props} className={className} style={{left: leftOffset}} onClick={handleClick}>
        <div ref={containerRef} className={containerClassName}>
          <InputComponent
            value={value}
            onChange={setValue}
            ref={inputRef}
            properties={properties}
            title={title}
            floatingElementRef={floatingElementRef}
            className={styles.cellUpdateInput}
            error={error}
            onClose={handleDiscardEdit}
            onSave={handleSave}
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
