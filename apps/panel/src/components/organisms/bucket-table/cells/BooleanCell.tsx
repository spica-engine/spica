import React, { useEffect, useState, useRef } from "react";
import type { CellRendererProps, CellKeyboardHandler } from "../types";
import { BaseCellRenderer } from "./BaseCellRenderer";
import styles from "./Cells.module.scss";
import { BooleanMinimizedInput } from "oziko-ui-kit";

export const BooleanCell: React.FC<CellRendererProps> = ({
  value,
  onChange,
  isFocused,
  onRequestBlur,
}) => {

  const [localValue, setLocalValue] = useState<boolean | undefined>(value);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleChange = (checked: boolean) => {
    setLocalValue(checked);
  };


  useEffect(() => {
    if (!isFocused) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        onChange(localValue ?? value);
        onRequestBlur();
      } else if (e.key === " ") {
        e.preventDefault();
        e.stopPropagation();
        setLocalValue((prev) =>
          typeof prev === "boolean" ? !prev : !value
        );
      }
    };

    globalThis.addEventListener("keydown", handleKeyDown);
    return () => {
      globalThis.removeEventListener("keydown", handleKeyDown);
    };
  }, [isFocused, localValue, value, onChange, onRequestBlur]);

  const committedValue = value ?? false;
  const draftValue = (localValue ?? value) ?? false;

  return (
    <BaseCellRenderer isFocused={isFocused} className={styles.booleanCheckbox}>
      {isFocused ? (
        <BooleanMinimizedInput
          checked={draftValue}
          onChange={handleChange}
        />
      ) : (
        <span className={styles.booleanDisplay}>
          {String(committedValue)}
        </span>
      )}
    </BaseCellRenderer>
  );
};

export const BooleanCellKeyboardHandler: CellKeyboardHandler = {
  handleKeyDown: (event, _context) => {
    if (event.key === " " || event.key === "Enter") {
      return true;
    }
    return false;
  },
};
