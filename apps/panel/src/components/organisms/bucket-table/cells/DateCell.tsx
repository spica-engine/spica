import React, { useEffect, useState } from "react";
import type { CellRendererProps, CellKeyboardHandler } from "../types";
import { BaseCellRenderer } from "./BaseCellRenderer";
import {DatePicker} from "oziko-ui-kit";
import styles from "./Cells.module.scss";

export const DateCell: React.FC<CellRendererProps> = ({
  value,
  onChange,
  isFocused,
  onRequestBlur,
}) => {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [localValue, setLocalValue] = useState<string | null>(value);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  useEffect(() => {
    if (isFocused) {
      setPickerOpen(true);
    } else {
      setPickerOpen(false);
    }
  }, [isFocused]);

  const handleDateChange = (newValue: string | string[] | null) => {
    const dateValue = newValue && typeof newValue === "string" ? new Date(newValue).toISOString() : null;
    setLocalValue(dateValue);
    onChange(dateValue);
  };

  const handleOpenChange = (open: boolean) => {
    setPickerOpen(open);
    if (!open) {
      onRequestBlur();
    }
  };


  return (
    <BaseCellRenderer isFocused={isFocused}>
      <DatePicker
        value={localValue || null}
        onChange={handleDateChange}
        open={pickerOpen}
        format="YYYY-MM-DD HH:mm:ss"
        onOpenChange={handleOpenChange}
        placeholder="Invalid Date"
        className={styles.dateInput}
        showTime

      />
    </BaseCellRenderer>
  );
};

export const DateCellKeyboardHandler: CellKeyboardHandler = {
  handleKeyDown: (event, context) => {

    if (event.key === "Enter") {
      return true;
    }
    
    return false;
  }
};

