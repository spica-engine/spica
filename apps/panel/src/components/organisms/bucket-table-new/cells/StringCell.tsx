import React, { useEffect, useRef, useState } from "react";
import type { CellRendererProps, CellKeyboardHandler } from "../types";
import { BaseCellRenderer } from "./BaseCellRenderer";

export const StringCell: React.FC<CellRendererProps> = ({
  value,
  onChange,
  isFocused,
  onRequestBlur,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value || "");
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync editValue with value prop when not editing
  useEffect(() => {
    if (!isEditing) {
      setEditValue(value || "");
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
      // When cell gets focus via keyboard, enter edit mode
      setIsEditing(true);
    } else {
      setIsEditing(false);
    }
  }, [isFocused]);

  const handleSave = () => {
    if (editValue !== value) {
      onChange(editValue);
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValue(value || "");
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
    // Stop propagation to prevent table navigation while editing
    e.stopPropagation();
  };

  if (isEditing) {
    return (
      <BaseCellRenderer isFocused={isFocused}>
        <input
          ref={inputRef}
          type="text"
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
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {value || ""}
      </span>
    </BaseCellRenderer>
  );
};

export const StringCellKeyboardHandler: CellKeyboardHandler = {
  handleKeyDown: (event, context) => {
    // Any alphanumeric key should trigger edit mode
    // This is handled by the StringCell component internally
    // We just need to signal that this cell can handle typing
    const isTypingKey = 
      event.key.length === 1 || 
      event.key === "Backspace" || 
      event.key === "Delete";
    
    if (isTypingKey) {
      // The component will handle this in its own effect
      return true;
    }
    
    return false;
  }
};

