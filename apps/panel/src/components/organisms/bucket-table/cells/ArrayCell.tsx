/**
 * @owner Kanan Gasimov
 * email: rio.kenan@gmail.com
 */

import {ArrayMinimizedInput} from "oziko-ui-kit";
import React, { useCallback, useEffect, useState } from "react";
import type {CellKeyboardHandler, CellRendererProps} from "../types";
import {BaseCellRenderer} from "./BaseCellRenderer";

export const ArrayCell: React.FC<CellRendererProps> = ({
  value,
  onChange,
  property,
  propertyKey,
  isFocused,
  onRequestBlur
}) => {
  const [localValue, setLocalValue] = useState<any>(value ?? []);

  useEffect(() => {
    if (!isFocused) {
      setLocalValue(value ?? []);
    }
  }, [value, isFocused]);

  const handleChange = (newValue: any) => {
    setLocalValue(newValue);
  };
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    
    const actions: Partial<Record<KeyboardEvent["key"], () => void>> = {
      Enter: () => {
        onChange(localValue);
      },
      Escape: () => {
        setLocalValue(value ?? []);
      },
    };

    const action = actions[e.key];
    if (!action) return;

    e.preventDefault();
    e.stopPropagation();

    action();
    onRequestBlur();
  }, [localValue, value, onChange, onRequestBlur]);

  useEffect(() => {
    if (!isFocused) return;
  
    globalThis.addEventListener("keydown", handleKeyDown);
  
    return () => {
      globalThis.removeEventListener("keydown", handleKeyDown);
    };
  }, [isFocused, handleKeyDown]);

  const normalizedItems = React.useMemo(() => {
    if (!property.items) return undefined;

    if (property.items.type && !('properties' in property.items)) {
      return {
        type: property.items.type,
        title: property.items.title,
        properties: property.items.properties,
      };
    }

    return property.items;
  }, [property.items]);

  return (
    <BaseCellRenderer isFocused={isFocused}>
      <ArrayMinimizedInput
        value={localValue}
        onChange={handleChange}
        items={normalizedItems}
        propertyKey={propertyKey}
        popoverProps={{
          open: isFocused,
          onClose: () => {
            onRequestBlur();
          },
          childrenProps: {
            dimensionY: 30
          }
        }}
        buttonsContainerProps={{
          dimensionY: "fill"
        }}
      />
    </BaseCellRenderer>
  );
};
export const ArrayCellKeyboardHandler: CellKeyboardHandler = {
  handleKeyDown: (event, context) => {
    return event.key === "Enter" || event.key === " "
  }
};
