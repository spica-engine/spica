import React from "react";
import type { CellRendererProps } from "../types";
import styles from "./Cells.module.scss";

/**
 * Default fallback cell for unsupported types
 * Displays raw JSON value
 */
export const DefaultCell: React.FC<CellRendererProps> = ({
  value,
  property,
}) => {
  const displayValue = () => {
    if (value === null || value === undefined) return "";
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
  };

  return (
    <span className={styles.defaultValueCell}>
      {displayValue()} <span className={styles.defaultTypeLabel}>({property.type})</span>
    </span>
  );
};

