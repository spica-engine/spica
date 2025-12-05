/**
 * @owner Kanan Gasimov
 * email: rio.kenan@gmail.com
 */

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { BaseCellRenderer } from './BaseCellRenderer'
import type { CellRendererProps, CellKeyboardHandler, CellKeyboardContext } from '../types'
import { Popover, TextAreaMinimizedInput } from 'oziko-ui-kit'
import styles from './Cells.module.scss'

export const TextareaCell: React.FC<CellRendererProps> = ({
  value,
  onChange,
  isFocused,
  onRequestBlur,
}) => {
  const normalizedValue = value ?? "";
  const [editValue, setEditValue] = useState(normalizedValue);
  const editValueRef = useRef(editValue);
  const [pendingValue, setPendingValue] = useState<{ value: string; baseValue: string } | null>(null);

  useEffect(() => {
    editValueRef.current = editValue;
  }, [editValue]);

  useEffect(() => {
    if (!isFocused) {
      setEditValue(normalizedValue);
    }
  }, [normalizedValue, isFocused]);

  useEffect(() => {
    if (!pendingValue) return;

    if (normalizedValue !== pendingValue.baseValue) {
      setPendingValue(null);
    }
  }, [normalizedValue, pendingValue]);

  const handleChange = useCallback((newValue: string) => {
    setEditValue(newValue);
    setPendingValue({ value: newValue, baseValue: normalizedValue });
  }, [normalizedValue]);

  const handleSave = useCallback(() => {
    if (editValue !== normalizedValue) {
      onChange(editValue);
      setPendingValue({ value: editValue, baseValue: normalizedValue });
    }
  }, [editValue, normalizedValue, onChange]);

  const handleBlur = useCallback(() => {
    handleSave();
    onRequestBlur();
  }, [handleSave, onRequestBlur]);

  const handlePopoverClose = useCallback(() => {
    handleSave();
    onRequestBlur();
  }, [handleSave, onRequestBlur]);

  const handleClear = useCallback(() => {
    setEditValue("");
    onChange("");
    setPendingValue(null);
  }, [onChange]);

  useEffect(() => {
    if (!isFocused) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        return;
      }
      
      if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        const currentEditValue = editValueRef.current;
        if (currentEditValue !== normalizedValue) {
          onChange(currentEditValue);
          setPendingValue({ value: currentEditValue, baseValue: normalizedValue });
        }
        onRequestBlur();
      } else if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        setEditValue(normalizedValue);
        setPendingValue(null);
        onRequestBlur();
      }
    };

    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [isFocused, normalizedValue, onChange, onRequestBlur]);

  return (  
    <BaseCellRenderer isFocused={isFocused}>
      <div className={styles.textareaCellContainer}>
        <Popover
          open={isFocused}
          onClose={handlePopoverClose}
          content={
            <TextAreaMinimizedInput
              value={editValue}
              onChange={handleChange}
              onBlur={handleBlur}
              root={{
                className: styles.textAreaRoot
              }}
              suffix={{
                className: styles.textAreaClearButton
              }}
              className={styles.textareaInput}
              focusedRows={5}
              rows={5}
              cols={30}
              onClear={handleClear}
            />
          }
          contentProps={{ className: styles.textAreaContent }}
          containerProps={{
            dimensionX: "fill", 
            dimensionY: "fill", 
            className: styles.textAreaContainer
          }}
        >
          <span className={styles.valueCell}>
            {normalizedValue}
          </span>
        </Popover>
      </div>
    </BaseCellRenderer>
  )
}

export const TextareaCellKeyboardHandler: CellKeyboardHandler = {
  handleKeyDown: (event: KeyboardEvent, context: CellKeyboardContext): boolean => {
    const isTypingKey = 
      event.key.length === 1 || 
      event.key === "Backspace" || 
      event.key === "Delete" ||
      event.key === "Enter";
    
    if (isTypingKey) {
      return true;
    }
    
    return false;
  }
};