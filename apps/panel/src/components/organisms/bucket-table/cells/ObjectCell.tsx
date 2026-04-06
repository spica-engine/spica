/**
 * @owner Kanan Gasimov
 * email: rio.kenan@gmail.com
 */

import React, { useCallback, useEffect, useState } from 'react'
import type { CellRendererProps, CellKeyboardHandler } from "../types";
import { BaseCellRenderer } from "./BaseCellRenderer";
import styles from "./Cells.module.scss";
import { ObjectMinimizedInput } from "oziko-ui-kit";
import type { TypeProperties } from "oziko-ui-kit/dist/custom-hooks/useInputRepresenter";

export const ObjectCell: React.FC<CellRendererProps> = ({
  value,
  onChange,
  property,
  isFocused,
  onRequestBlur,
}) => {
  const [localValue, setLocalValue] = useState<any>(value ?? {});

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const actions: Partial<Record<KeyboardEvent["key"], () => void>> = {
        Enter: () => onChange(localValue),
        Escape: () => setLocalValue(value ?? {}),
      };
  
      const action = actions[e.key];
      if (!action) return;
  
      e.preventDefault();
      e.stopPropagation();
  
      action();
      onRequestBlur();
    },
    [localValue, value, onChange, onRequestBlur]
  );

  useEffect(() => {
    if (!isFocused) {
      setLocalValue(value ?? {});
    }
  }, [value, isFocused]);

  const handleChange = (newValue: any) => {
    setLocalValue(newValue);
  };

  useEffect(() => {
    if (!isFocused) return;
  
    globalThis.addEventListener("keydown", handleKeyDown);
  
    return () => {
      globalThis.removeEventListener("keydown", handleKeyDown);
    };
  }, [isFocused, handleKeyDown]);

  const properties: TypeProperties = React.useMemo(() => {
    if (!property?.properties) {
      return {};
    }

    return property.properties as unknown as TypeProperties;
  }, [property?.properties]);

  return (
    <BaseCellRenderer isFocused={isFocused}>
      <ObjectMinimizedInput
        value={localValue}
        properties={properties}
        onChange={handleChange}
        dimensionX="fill"
        dimensionY={30}
        className={styles.objectCell}
        popoverProps={{
          open: isFocused,
          onClose: () => {
            onRequestBlur();
          }
        }}
      />
    </BaseCellRenderer>
  );
};

export const ObjectCellKeyboardHandler: CellKeyboardHandler = {
  handleKeyDown: (event, _context) => {
    return event.key === "Enter" || event.key === " ";
  },
};

