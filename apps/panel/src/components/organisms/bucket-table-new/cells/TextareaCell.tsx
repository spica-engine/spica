import React, { useEffect, useRef, useState } from "react";
import type { CellRendererProps, CellKeyboardHandler } from "../types";
import { BaseCellRenderer } from "./BaseCellRenderer";

export const TextareaCell: React.FC<CellRendererProps> = ({
  value,
  onChange,
  isFocused,
  onRequestBlur,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value || "");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync editValue with value prop when not editing
  useEffect(() => {
    if (!isEditing) {
      setEditValue(value || "");
    }
  }, [value, isEditing]);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
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

  const handleTextareaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Ctrl/Cmd + Enter to save
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
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
        <textarea
          ref={textareaRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleTextareaKeyDown}
          style={{
            width: "100%",
            minHeight: "60px",
            border: "1px solid #4CAF50",
            borderRadius: "4px",
            padding: "4px 8px",
            outline: "none",
            resize: "vertical",
          }}
        />
      </BaseCellRenderer>
    );
  }

  return (
    <BaseCellRenderer isFocused={isFocused}>
      <span
        style={{
          overflow: "hidden",
          textOverflow: "ellipsis",
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
        }}
      >
        {value || ""}
      </span>
    </BaseCellRenderer>
  );
};

export const TextareaCellKeyboardHandler: CellKeyboardHandler = {
  handleKeyDown: (event, context) => {
    const isTypingKey = 
      event.key.length === 1 || 
      event.key === "Backspace" || 
      event.key === "Delete";
    
    if (isTypingKey) {
      return true;
    }
    
    return false;
  }
};

