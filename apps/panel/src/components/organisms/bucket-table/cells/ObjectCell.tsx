/**
 * @owner Kanan Gasimov
 * email: rio.kenan@gmail.com
 */

import React from 'react'
import type { CellRendererProps } from "../types";
import styles from "./Cells.module.scss";
import { Popover } from "oziko-ui-kit";
import type {
  TypeChangeEvent,
  TypeProperties,
} from "oziko-ui-kit/dist/custom-hooks/useInputRepresenter";
import { useCellState } from "../useCellSelection";
import { popoverWidthForSchema } from "./schemaDepth";
import ObjectFieldInput from "../../../atoms/object-field-input/ObjectFieldInput";

const cx = (...classes: (string | false | undefined)[]) => classes.filter(Boolean).join(" ");

const summarize = (value: any): string => {
  if (value == null) return "";
  try {
    return JSON.stringify(value);
  } catch {
    // A circular structure makes JSON.stringify throw; String(value) would then leak
    // "[object Object]", so fall back to a neutral placeholder instead.
    return Array.isArray(value) ? "[…]" : "{…}";
  }
};

export const ObjectCell: React.FC<CellRendererProps> = ({
  value,
  onChange,
  property,
  propertyKey,
  rowId,
}) => {
  const { isSelected, isEditing, select, requestEdit, exitEdit } = useCellState(rowId, propertyKey);

  const properties: TypeProperties = React.useMemo(() => {
    if (!property?.properties) {
      return {};
    }

    return property.properties as unknown as TypeProperties;
  }, [property?.properties]);

  const preview = summarize(value);

  const popoverWidth = React.useMemo(() => popoverWidthForSchema(property), [property]);

  // The atom emits {key, value} events (its drawer contract); the cell commit path
  // wants the bare new value, so unwrap here. Nested objects/arrays and the
  // free-form JSON fallback all flow through this same recursive editor.
  const handleObjectChange = React.useCallback(
    (event: TypeChangeEvent<any>) => onChange(event.value),
    [onChange]
  );

  return (
    <Popover
      open={isEditing}
      onClose={exitEdit}
      content={
        <div
          className={styles.complexEditorPopover}
          style={{ ["--complex-editor-width" as any]: popoverWidth }}
          onClick={e => e.stopPropagation()}
        >
          <ObjectFieldInput
            fieldKey={propertyKey}
            value={value ?? {}}
            properties={properties}
            onChange={handleObjectChange}
            className={styles.objectCell}
          />
        </div>
      }
      containerProps={{ dimensionX: "fill", dimensionY: "fill", className: styles.cellShellContainer }}
      childrenProps={{ dimensionX: "fill", dimensionY: "fill" }}
    >
      <span
        className={cx(styles.readDisplay, isSelected && styles.cellSelected)}
        onClick={e => {
          e.stopPropagation();
          isSelected ? requestEdit() : select();
        }}
        onDoubleClick={e => {
          e.stopPropagation();
          requestEdit();
        }}
      >
        {preview}
      </span>
    </Popover>
  );
};
