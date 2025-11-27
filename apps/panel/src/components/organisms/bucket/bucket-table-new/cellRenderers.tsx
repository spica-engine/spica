/**
 * @owner Kanan Gasimov
 * email: rio.kenan@gmail.com
 */

import React, {useState, useRef, useEffect} from "react";
import {Input} from "oziko-ui-kit";
import {FieldKind, FIELD_REGISTRY} from "../../../../domain/fields";
import type {Property} from "../../../../services/bucketService";

// Common props for all cell renderers
export interface CellRendererProps {
  value: any;
  fieldKey: string;
  rowId: string;
  rowIndex: number;
  property: Property;
  onSave: (value: any) => void;
  registerCellAction: (
    columnKey: string,
    rowIndex: number,
    actions: {onEnter?: () => void; onEscape?: () => void}
  ) => void;
}

// Type for cell renderer components
export type CellRendererStrategy = React.FC<CellRendererProps>;

/**
 * String Cell Renderer
 * Renders an editable input field for string values
 */
export const StringCellRenderer: CellRendererStrategy = ({
  value,
  fieldKey,
  rowId,
  rowIndex,
  property,
  onSave,
  registerCellAction
}) => {
  const [localValue, setLocalValue] = useState<string>(value || "");
  const [isEditing, setIsEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const initialValueRef = useRef<string>(value || "");

  // Update local value when prop changes
  useEffect(() => {
    setLocalValue(value || "");
    initialValueRef.current = value || "";
  }, [value]);

  // Register cell actions for keyboard navigation
  useEffect(() => {
    registerCellAction(fieldKey, rowIndex, {
      onEnter: () => {
        console.log("onEnter");
        
        setIsEditing(true);
        // Focus the input after state update
        setTimeout(() => {
          inputRef.current?.focus();
        }, 0);
      },
      onEscape: () => {
        if (isEditing) {
          // Cancel editing and restore original value
          setLocalValue(initialValueRef.current);
          setIsEditing(false);
          inputRef.current?.blur();
        }
      }
    });
  }, [fieldKey, rowIndex, registerCellAction, isEditing]);

  const handleBlur = () => {
    setIsEditing(false);
    // Only save if value changed
    if (localValue !== initialValueRef.current) {
      onSave(localValue);
      initialValueRef.current = localValue;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleBlur();
      inputRef.current?.blur();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalValue(e.target.value);
  };

  const handleCellClick = () => {
    inputRef.current?.focus();
  };

  return (
    <div
      data-cell-key={`${fieldKey}-${rowIndex}`}
      onClick={handleCellClick}
      style={{
        width: "100%",
        height: "100%",
        cursor: "text"
      }}
    >
      <Input
        ref={inputRef}
        value={localValue}
        onChange={handleChange}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        onFocus={() => setIsEditing(true)}
        style={{
          width: "100%",
          height: "100%",
          border: "none",
          outline: "none",
          pointerEvents: "auto"
        }}
      />
    </div>
  );
};

/**
 * Read-only Cell Renderer
 * Used for field types that don't have a custom renderer yet
 */
export const ReadOnlyCellRenderer: CellRendererStrategy = ({
  value,
  fieldKey,
  rowIndex,
  property,
  registerCellAction
}) => {
  const fieldType = property.type as FieldKind;
  const displayValue = FIELD_REGISTRY[fieldType]?.getDisplayValue?.(value, property) ?? value;

  // Register empty actions (read-only cells don't respond to Enter/Escape)
  useEffect(() => {
    registerCellAction(fieldKey, rowIndex, {
      onEnter: () => {
        console.log("onEnter");
        
        // No action for read-only cells
      },
      onEscape: () => {
        // No action for read-only cells
      }
    });
  }, [fieldKey, rowIndex, registerCellAction]);

  return (
    <div
      data-cell-key={`${fieldKey}-${rowIndex}`}
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        padding: "0 8px",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap"
      }}
    >
      {typeof displayValue === "object" ? JSON.stringify(displayValue) : String(displayValue ?? "")}
    </div>
  );
};

/**
 * Cell Renderer Factory
 * Maps field types to their appropriate renderer component
 */
export function getCellRenderer(fieldType: FieldKind): CellRendererStrategy {
  switch (fieldType) {
    case FieldKind.String:
      return StringCellRenderer;
    
    // Future implementations:
    // case FieldKind.Number:
    //   return NumberCellRenderer;
    // case FieldKind.Boolean:
    //   return BooleanCellRenderer;
    // case FieldKind.Date:
    //   return DateCellRenderer;
    // case FieldKind.Textarea:
    //   return TextareaCellRenderer;
    
    default:
      return ReadOnlyCellRenderer;
  }
}

