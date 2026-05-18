import React from "react";
import type { CellRendererProps } from "../types";
import {DatePicker} from "oziko-ui-kit";
import styles from "./Cells.module.scss";

export const DateCell: React.FC<CellRendererProps> = ({ value, onChange }) => {
  const handleDateChange = (newValue: string | string[] | null) => {
    const dateValue = newValue && typeof newValue === "string" ? new Date(newValue).toISOString() : null;
    onChange(dateValue);
  };

  return (
    <DatePicker
      value={value || null}
      onChange={handleDateChange}
      format="YYYY-MM-DD HH:mm:ss"
      placeholder="Invalid Date"
      className={styles.dateInput}
      showTime
    />
  );
};

