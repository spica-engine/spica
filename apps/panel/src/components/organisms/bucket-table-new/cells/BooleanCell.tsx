import React from "react";
import type { CellRendererProps, CellKeyboardHandler } from "../types";
import { BaseCellRenderer } from "./BaseCellRenderer";

export const BooleanCell: React.FC<CellRendererProps> = ({
  value,
  onChange,
  isFocused,
}) => {
  const handleToggle = () => {
    onChange(!value);
  };

  return (
    <BaseCellRenderer isFocused={isFocused} onClick={handleToggle}>
      <input
        type="checkbox"
        checked={!!value}
        onChange={handleToggle}
        style={{ cursor: "pointer", width: "18px", height: "18px" }}
      />
    </BaseCellRenderer>
  );
};

export const BooleanCellKeyboardHandler: CellKeyboardHandler = {
  handleKeyDown: (event, context) => {
    if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      context.onChange(!context.value);
      return true;
    }
    
    return false;
  }
};

