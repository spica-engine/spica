import React from "react";
import type { CellRendererProps, CellKeyboardHandler } from "../types";
import { BaseCellRenderer } from "./BaseCellRenderer";
import styles from "./Cells.module.scss";

/**
 * Default fallback cell for unsupported types
 * Displays raw JSON value
 */
export const DefaultCell: React.FC<CellRendererProps> = ({
  value,
  isFocused,
  property,
}) => {
  const displayValue = () => {
    if (value === null || value === undefined) return "";
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
  };

  return (
    <BaseCellRenderer isFocused={isFocused}>
      <span className={styles.defaultValueCell}>
        {displayValue()} <span className={styles.defaultTypeLabel}>({property.type})</span>
      </span>
    </BaseCellRenderer>
  );
};

export const DefaultCellKeyboardHandler: CellKeyboardHandler = {
  handleKeyDown: () => {
    // No special keyboard handling for unknown types
    return false;
  }
};

