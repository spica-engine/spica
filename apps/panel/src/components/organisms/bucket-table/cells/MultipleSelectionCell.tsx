import React from "react";
import type { CellRendererProps } from "../types";
import { MultipleSelectionMinimizedInput } from "oziko-ui-kit";
import styles from "./Cells.module.scss";

export const MultipleSelectionCell: React.FC<CellRendererProps> = ({
  value,
  onChange,
  property,
}) => {
  const options = property.items?.enum || property.enum || [];
  const normalizedValue = Array.isArray(value) ? value : [];

  return (
    <div className={styles.multiSelectCellWrapper}>
      <MultipleSelectionMinimizedInput
        dimensionY={34}
        options={options}
        value={normalizedValue}
        onChange={onChange}
        className={styles.multiSelectInput}
      />
    </div>
  );
};

