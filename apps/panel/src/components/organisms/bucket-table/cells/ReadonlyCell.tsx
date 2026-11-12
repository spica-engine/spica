import React from "react";
import type { CellRendererProps } from "../types";
import { useCellState } from "../useCellSelection";
import styles from "./Cells.module.scss";

const cx = (...classes: (string | false | undefined)[]) => classes.filter(Boolean).join(" ");

/**
 * A value that is shown and selectable but never edited in place: a document's key.
 */
export const ReadonlyCell: React.FC<CellRendererProps> = React.memo(
  ({ value, propertyKey, rowId }) => {
    const { isSelected, select } = useCellState(rowId, propertyKey);

    return (
      <span
        className={cx(styles.readDisplay, isSelected && styles.cellSelected)}
        onClick={(e) => {
          e.stopPropagation();
          select();
        }}
      >
        {value === null || value === undefined ? "" : String(value)}
      </span>
    );
  }
);

ReadonlyCell.displayName = "ReadonlyCell";
