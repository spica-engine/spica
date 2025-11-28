import React, { useEffect, useRef, useState } from "react";
import type { CellRendererProps, CellKeyboardHandler } from "../types";
import { BaseCellRenderer } from "./BaseCellRenderer";

export const NumberCell: React.FC<CellRendererProps> = ({
  value,
  onChange,
  isFocused,
  onRequestBlur,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value?.toString() || "");
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync editValue with value prop when not editing
  useEffect(() => {
    if (!isEditing) {
      setEditValue(value?.toString() || "");
    }
  }, [value, isEditing]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
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
    const numValue = editValue === "" ? null : Number(editValue);
    if (numValue !== value) {
      onChange(numValue);
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValue(value?.toString() || "");
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

  if (isEditing) {
    return (
      <BaseCellRenderer isFocused={isFocused}>
        <input
          ref={inputRef}
          type="number"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleInputKeyDown}
          style={{
            width: "100%",
            border: "1px solid #4CAF50",
            borderRadius: "4px",
            padding: "4px 8px",
            outline: "none",
          }}
        />
      </BaseCellRenderer>
    );
  }

  return (
    <BaseCellRenderer isFocused={isFocused}>
      <span>{value ?? ""}</span>
    </BaseCellRenderer>
  );
};

export const NumberCellKeyboardHandler: CellKeyboardHandler = {
  handleKeyDown: (event, context) => {
    const isNumberKey = /^[0-9\-.]$/.test(event.key) || 
                       event.key === "Backspace" || 
                       event.key === "Delete";
    
    if (isNumberKey) {
      return true;
    }
    
    return false;
  }
};

