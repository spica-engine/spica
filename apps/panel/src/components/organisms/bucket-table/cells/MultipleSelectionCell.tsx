import React, { useEffect, useState, useRef } from "react";
import type { CellRendererProps, CellKeyboardHandler } from "../types";
import { BaseCellRenderer } from "./BaseCellRenderer";
import { MultipleSelectionMinimizedInput } from "oziko-ui-kit";
import styles from "./Cells.module.scss";

export const MultipleSelectionCell: React.FC<CellRendererProps> = ({
  value,
  onChange,
  property,
  isFocused,
  onRequestBlur,
}) => {
  const [editValue, setEditValue] = useState<(string | number)[]>(
    Array.isArray(value) ? value : []
  );
  const [originalValue, setOriginalValue] = useState<(string | number)[]>(
    Array.isArray(value) ? value : []
  );
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef<HTMLDivElement>(null);
  
  const options = property.items?.enum || property.enum || [];

  useEffect(() => {
    const normalizedValue = Array.isArray(value) ? value : [];
    setEditValue(normalizedValue);
    setOriginalValue(normalizedValue);
  }, [value]);

  useEffect(() => {
    if (isFocused) {
      setIsOpen(true);
      setTimeout(() => {
        const input = inputRef.current?.querySelector('input, [role="combobox"]');
        if (input instanceof HTMLElement) {
          input.click();
        }
      }, 0);
      return;
    }
    
    if (isOpen && JSON.stringify(editValue) !== JSON.stringify(originalValue)) {
      onChange(editValue);
    }
    setIsOpen(false);
  }, [isFocused]);

  const handleCancel = () => {
    setEditValue(originalValue);
    setIsOpen(false);
    onRequestBlur();
  };

  const handleValueChange = (newValue: any) => {
    const normalizedValue = Array.isArray(newValue) ? newValue : [];
    setEditValue(normalizedValue);
  };

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      
      if (e.key === "Escape") {
        handleCancel();
      } else if (e.key === "Enter") {
        if (JSON.stringify(editValue) !== JSON.stringify(originalValue)) {
          onChange(editValue);
        }
        setIsOpen(false);
        onRequestBlur();
      }
    };

    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [isOpen, originalValue, editValue]);

  return (
    <BaseCellRenderer isFocused={isFocused}>
      <div 
        ref={inputRef}
        className={styles.multiSelectCellWrapper}
      >
        <MultipleSelectionMinimizedInput 
          dimensionY={34}
          options={options}
          value={editValue}
          onChange={handleValueChange}
          className={styles.multiSelectInput}
        />
      </div>
    </BaseCellRenderer>
  );
};

export const MultipleSelectionCellKeyboardHandler: CellKeyboardHandler = {
  handleKeyDown: (event, context) => {
    if (event.key === "Enter" || event.key === " ") {
      return true;
    }
    
    return false;
  }
};

