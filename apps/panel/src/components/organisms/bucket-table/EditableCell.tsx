import React, { useCallback, useEffect, useRef, useState } from "react";
import { cellRegistry } from "./cellRegistry";
import type { BucketProperty, CellKeyboardContext } from "./types";

interface EditableCellProps {
  value: any;
  propertyKey: string;
  property: BucketProperty;
  rowId: string;
  isFocused: boolean;
  onValueChange: (propertyKey: string, rowId: string, newValue: any) => void;
  onRequestBlur: () => void;
}

export const EditableCell: React.FC<EditableCellProps> = ({
  value,
  propertyKey,
  property,
  rowId,
  isFocused,
  onValueChange,
  onRequestBlur,
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
    if (!isReadonly && isFocused) {
      setIsEditMode(true);
    }
  }, [isFocused, isReadonly]);

  useEffect(() => {
    if (!isFocused || isReadonly) {
      setIsEditMode(false);
      return;
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
  }, [isFocused, isReadonly, value, property, propertyKey, rowId, keyboardHandler, handleValueChange, handleRequestBlur]);

  return (
    <div 
      ref={cellRef} 
      style={{ width: "100%", height: "100%", cursor: isReadonly ? "default" : "pointer" }}
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

