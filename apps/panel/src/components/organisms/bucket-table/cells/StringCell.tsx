import React, { useEffect, useRef, useState } from "react";
import type { CellRendererProps, CellKeyboardHandler } from "../types";
import { BaseCellRenderer } from "./BaseCellRenderer";
import styles from "./Cells.module.scss";

export const StringCell: React.FC<CellRendererProps> = ({
  value,
  onChange,
  isFocused,
  onRequestBlur,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value || "");
  const [pendingValue, setPendingValue] = useState<{ value: string; baseValue: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const normalizedValue = value ?? "";

  // Sync editValue with value prop when not editing
  useEffect(() => {
    if (!isEditing) {
      setEditValue(normalizedValue);
    }
  }, [normalizedValue, isEditing]);

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

  useEffect(() => {
    if (!pendingValue) return;

    if (normalizedValue !== pendingValue.baseValue) {
      setPendingValue(null);
    }
  }, [normalizedValue, pendingValue]);

  const handleSave = () => {
    if (editValue !== value) {
      onChange(editValue);
      setPendingValue({ value: editValue, baseValue: normalizedValue });
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValue(value || "");
    setIsEditing(false);
    onRequestBlur();
    setPendingValue(null);
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
          className={styles.inputCell}
        />
      </BaseCellRenderer>
    );
  }

  return (
    <BaseCellRenderer isFocused={isFocused}>
      <span className={styles.valueCell}>
        {pendingValue?.value ?? normalizedValue}
      </span>
    </BaseCellRenderer>
  );
};

export const StringCellKeyboardHandler: CellKeyboardHandler = {
  handleKeyDown: (event, context) => {

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

