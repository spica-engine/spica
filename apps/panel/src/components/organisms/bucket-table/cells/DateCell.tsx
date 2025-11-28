import React, { useEffect, useRef, useState } from "react";
import type { CellRendererProps, CellKeyboardHandler } from "../types";
import { BaseCellRenderer } from "./BaseCellRenderer";
import styles from "./Cells.module.scss";

export const DateCell: React.FC<CellRendererProps> = ({
  value,
  onChange,
  isFocused,
  onRequestBlur,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(() => {
    if (!value) return "";
    const date = new Date(value);
    return date.toISOString().split("T")[0];
  });
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isEditing) {
      if (!value) {
        setEditValue("");
      } else {
        const date = new Date(value);
        setEditValue(date.toISOString().split("T")[0]);
      }
    }
  }, [value, isEditing]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  useEffect(() => {
    if (isFocused) {
      setIsEditing(true);
    } else {
      setIsEditing(false);
    }
  }, [isFocused]);

  const handleSave = () => {
    const newDate = editValue ? new Date(editValue).toISOString() : null;
    if (newDate !== value) {
      onChange(newDate);
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    const date = value ? new Date(value) : null;
    setEditValue(date ? date.toISOString().split("T")[0] : "");
    setIsEditing(false);
    onRequestBlur();
  };

  const handleBlur = () => {
    handleSave();
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSave();
      onRequestBlur();
    } else if (e.key === "Escape") {
      e.preventDefault();
      handleCancel();
    }
    e.stopPropagation();
  };

  const formatDisplayDate = (dateValue: any) => {
    if (!dateValue) return "";
    const date = new Date(dateValue);
    return date.toLocaleDateString();
  };

  if (isEditing) {
    return (
      <BaseCellRenderer isFocused={isFocused}>
        <input
          ref={inputRef}
          type="date"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleInputKeyDown}
          className={styles.dateInput}
        />
      </BaseCellRenderer>
    );
  }

  return (
    <BaseCellRenderer isFocused={isFocused}>
      <span>{formatDisplayDate(value)}</span>
    </BaseCellRenderer>
  );
};

export const DateCellKeyboardHandler: CellKeyboardHandler = {
  handleKeyDown: (event, context) => {
    // Date picker opens on Enter
    if (event.key === "Enter") {
      return true;
    }
    
    return false;
  }
};

