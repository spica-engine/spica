import React from "react";
import type { CellRendererProps } from "../types";
import { useCellState } from "../useCellSelection";
import styles from "./Cells.module.scss";

const cx = (...classes: (string | false | undefined)[]) => classes.filter(Boolean).join(" ");

/**
 * Default fallback cell for unsupported types.
 * Selectable for keyboard navigation but never editable, regardless of grid editability.
 */
export const DefaultCell: React.FC<CellRendererProps> = React.memo(
  ({ value, property, propertyKey, rowId }) => {
    const { isSelected, select } = useCellState(rowId, propertyKey);

    const displayValue = () => {
      if (value === null || value === undefined) return "";
      // Never String() an object — that renders the literal "[object Object]". Show a
      // compact JSON preview, and fall back to a neutral placeholder if it is circular.
      if (typeof value === "object") {
        try {
          return JSON.stringify(value);
        } catch {
          return Array.isArray(value) ? "[…]" : "{…}";
        }
      }
      return String(value);
    };

    return (
      <span
        className={cx(styles.defaultValueCell, styles.readDisplay, isSelected && styles.cellSelected)}
        onClick={(e) => {
          e.stopPropagation();
          select();
        }}
      >
        {displayValue()} <span className={styles.defaultTypeLabel}>({property.type})</span>
      </span>
    );
  }
);

DefaultCell.displayName = "DefaultCell";
