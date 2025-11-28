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

/**
 * EditableCell - Wrapper that manages keyboard events and delegates rendering to cell type components
 * 
 * This component acts as a coordinator between the table and individual cell components.
 * It handles:
 * - Keyboard event delegation to appropriate cell handlers
 * - Focus state management
 * - Value change propagation
 */
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

  // Check if the cell is readonly
  const isReadonly = property.options?.readonly === true;

  // Handle keyboard events when cell is focused
  useEffect(() => {
    if (!isFocused || isReadonly) {
      setIsEditMode(false);
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      // Create keyboard context for the handler
      const context: CellKeyboardContext = {
        value,
        onChange: handleValueChange,
        property,
        propertyKey,
        rowId,
        onRequestBlur: handleRequestBlur,
      };

      // Let the cell-specific handler decide what to do
      const handled = keyboardHandler.handleKeyDown(event, context);

      // If the handler indicates it can handle typing, enter edit mode
      if (handled) {
        setIsEditMode(true);
      }
    };

    // Only attach keyboard listener if focused
    globalThis.addEventListener("keydown", handleKeyDown);

    return () => {
      globalThis.removeEventListener("keydown", handleKeyDown);
    };
  }, [isFocused, isReadonly, value, property, propertyKey, rowId, keyboardHandler, handleValueChange, handleRequestBlur]);

  return (
    <div ref={cellRef} style={{ width: "100%", height: "100%" }}>
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

