import React, { useCallback, useEffect, useRef, useState } from "react";
import { ColorPicker } from "oziko-ui-kit";
import type { CellRendererProps, CellKeyboardHandler } from "../types";
import { BaseCellRenderer } from "./BaseCellRenderer";
import styles from "./Cells.module.scss";

export const ColorCell: React.FC<CellRendererProps> = ({
  value,
  onChange,
  isFocused,
  onRequestBlur,
}) => {
  const normalizedValue = value ?? "#000000";
  const [localColorValue, setLocalColorValue] = useState(normalizedValue);
  const prevNormalizedValueRef = useRef(normalizedValue);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (normalizedValue !== prevNormalizedValueRef.current) {
      setLocalColorValue(normalizedValue);
      prevNormalizedValueRef.current = normalizedValue;
    }
  }, [normalizedValue]);

  const handleColorChange = (newColor: any) => {

    const colorString = typeof newColor === 'string' 
      ? newColor 
      : (newColor?.hex || newColor?.value || String(newColor || "#000000"));

    setLocalColorValue(colorString);
  };

  const handleSave = useCallback(() => {
    if (localColorValue !== normalizedValue) {
      onChange(localColorValue);
    }

    onRequestBlur();
  }, [localColorValue, normalizedValue, onChange, onRequestBlur]);


  useEffect(() => {
    if (!isFocused) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Enter") {
        event.preventDefault();
        event.stopPropagation();
        handleSave();

      }
    };

    globalThis.addEventListener("keydown", handleKeyDown);

    return () => {
      globalThis.removeEventListener("keydown", handleKeyDown);
    };
  }, [isFocused, handleSave]);

  return (
    <BaseCellRenderer isFocused={isFocused}>
      <div ref={containerRef} className={styles.colorCellContainer}>
        <ColorPicker
          value={localColorValue}
          onChange={handleColorChange}
        />
      </div>
    </BaseCellRenderer>
  );
};

export const ColorCellKeyboardHandler: CellKeyboardHandler = {
  handleKeyDown: () => {
    return false;
  }
};


