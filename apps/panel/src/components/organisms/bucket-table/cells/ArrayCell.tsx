/**
 * @owner Kanan Gasimov
 * email: rio.kenan@gmail.com
 */

import {Popover} from "oziko-ui-kit";
import type {TypeChangeEvent} from "oziko-ui-kit/dist/custom-hooks/useInputRepresenter";
import React from "react";
import type {CellRendererProps} from "../types";
import {useCellState} from "../useCellSelection";
import {popoverWidthForSchema} from "./schemaDepth";
import ArrayFieldInput from "../../../atoms/array-field-input/ArrayFieldInput";
import styles from "./Cells.module.scss";

const cx = (...classes: (string | false | undefined)[]) => classes.filter(Boolean).join(" ");

const MAX_BADGES = 3;

const badgeText = (item: any): string => {
  if (item == null) return "";
  if (typeof item === "object") return Array.isArray(item) ? `[${item.length}]` : "{…}";
  return String(item);
};

export const ArrayCell: React.FC<CellRendererProps> = ({
  value,
  onChange,
  property,
  propertyKey,
  rowId,
}) => {
  const {isSelected, isEditing, select, requestEdit, exitEdit} = useCellState(rowId, propertyKey);

  const normalizedItems = React.useMemo(() => {
    if (!property.items) return undefined;

    if (property.items.type && !('properties' in property.items)) {
      return {
        type: property.items.type,
        title: property.items.title,
        properties: property.items.properties,
      };
    }

    return property.items;
  }, [property.items]);

  const items: any[] = Array.isArray(value) ? value : [];

  const popoverWidth = React.useMemo(() => popoverWidthForSchema(property), [property]);

  // The atom emits {key, value} events (its drawer contract); the cell commit path
  // wants the bare new array, so unwrap here. Object-item arrays recurse into
  // ObjectFieldInput per item, free-form arrays fall back to a JSON editor, and
  // primitive arrays keep oziko's ArrayInput — none can show "[object Object]".
  const handleArrayChange = React.useCallback(
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
          <ArrayFieldInput
            fieldKey={propertyKey}
            title=""
            value={items}
            items={normalizedItems}
            onChange={handleArrayChange}
          />
        </div>
      }
      containerProps={{ dimensionX: "fill", dimensionY: "fill", className: styles.cellShellContainer }}
      childrenProps={{ dimensionX: "fill", dimensionY: "fill" }}
    >
      <span
        className={cx(
          styles.readDisplay,
          styles.arrayReadDisplay,
          isSelected && styles.cellSelected
        )}
        onClick={e => {
          e.stopPropagation();
          isSelected ? requestEdit() : select();
        }}
        onDoubleClick={e => {
          e.stopPropagation();
          requestEdit();
        }}
      >
        {items.slice(0, MAX_BADGES).map((item, index) => (
          <span key={index} className={styles.arrayBadge}>
            {badgeText(item)}
          </span>
        ))}
        {items.length > MAX_BADGES && (
          <span className={styles.arrayBadgeMore}>+{items.length - MAX_BADGES}</span>
        )}
      </span>
    </Popover>
  );
};
