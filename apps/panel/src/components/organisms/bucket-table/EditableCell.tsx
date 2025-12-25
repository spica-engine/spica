import React, { useCallback, useEffect, useRef, useState } from "react";
import { cellRegistry } from "./cellRegistry";
import type { BucketProperty, CellKeyboardContext } from "./types";
import styles from "./EditableCell.module.scss";

interface EditableCellProps {
  value: any;
  propertyKey: string;
  property: BucketProperty;
  rowId: string;
  isFocused: boolean;
  onValueChange: (propertyKey: string, rowId: string, newValue: any) => void;
  onRequestBlur: () => void;
  focusResetVersion: number;
}

export const EditableCell: React.FC<EditableCellProps> = ({
  value,
  propertyKey,
  property,
  rowId,
  isFocused,
  onValueChange,
  onRequestBlur,
  focusResetVersion,
}) => {
  const [isEditMode, setIsEditMode] = useState(false);
  const cellRef = useRef<HTMLDivElement>(null);

  const cellConfig = cellRegistry.get(property.type);
  const CellComponent = cellConfig.component;
  const keyboardHandler = cellConfig.keyboardHandler;

  const handleValueChange = useCallback((newValue: any) => {
    onValueChange(propertyKey, rowId, newValue);
  }, [onValueChange, propertyKey, rowId]);

  const handleRequestBlur = useCallback(() => {
    setIsEditMode(false);
    onRequestBlur();
  }, [onRequestBlur]);

  const isReadonly = property.options?.readonly === true;

  const handleClick = useCallback(() => {
    if (!isReadonly) {
      setIsEditMode(true);
    }
  }, [isReadonly]);

  useEffect(() => {
    if (!isFocused || isReadonly) {
      setIsEditMode(false);
      return;
    }

    if (cellConfig.autoEnterEditMode) {
      setIsEditMode(true);
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      const context: CellKeyboardContext = {
        value,
        onChange: handleValueChange,
        property,
        propertyKey,
        rowId,
        onRequestBlur: handleRequestBlur,
      };

      const handled = keyboardHandler.handleKeyDown(event, context);

      if (handled) {
        setIsEditMode(true);
      }
    };

    globalThis.addEventListener("keydown", handleKeyDown);

    return () => {
      globalThis.removeEventListener("keydown", handleKeyDown);
    };
  }, [isFocused, isReadonly, value, property, propertyKey, rowId, keyboardHandler, handleValueChange, handleRequestBlur, cellConfig]);

  useEffect(() => {
    if (isEditMode) {
      setIsEditMode(false);
    }
  }, [focusResetVersion]);

  return (
    <div 
      ref={cellRef} 
      className={`${styles.cellWrapper} ${isReadonly ? styles.readonly : ""}`}
      onClick={handleClick}
    >
      <CellComponent
        value={value}
        onChange={handleValueChange}
        property={property}
        propertyKey={propertyKey}
        rowId={rowId}
        isFocused={isFocused && isEditMode}
        onRequestBlur={handleRequestBlur}
      />
    </div>
  );
};

