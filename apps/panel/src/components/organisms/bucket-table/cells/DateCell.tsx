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

  useEffect(() => {
    if (isFocused) {
      setPickerOpen(true);
    } else {
      setPickerOpen(false);
    }
  }, [isFocused]);

  const handleDateChange = (newValue: string | string[] | null) => {
    if (newValue && typeof newValue === "string") {
      onChange(new Date(newValue).toISOString());
    } else {
      onChange(null);
    }
    setPickerOpen(false);
    onRequestBlur();
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
        value={value || null}
        onChange={handleDateChange}
        open={pickerOpen}
        onOpenChange={handleOpenChange}
        placeholder={value || "Invalid Date"}
        className={styles.dateInput}
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

