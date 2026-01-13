/**
 * @owner Kanan Gasimov
 * email: rio.kenan@gmail.com
 */

import React, {useCallback, useEffect, useState} from "react";
import type {FilterInputHandlerProps} from "./FilterInputHandlerRegistry";
import {ObjectMinimizedInput} from "oziko-ui-kit";

const ObjectInputHandler: React.FC<FilterInputHandlerProps> = ({value, onChange, property}) => {
  const [isOpen, setIsOpen] = useState(false);


  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const actions: Partial<Record<KeyboardEvent["key"], () => void>> = {
        Enter: () => onChange(value),
      };
  
      const action = actions[e.key];
      if (!action) return;
  
      e.preventDefault();
      e.stopPropagation();
  
      action();
      setIsOpen(false);
    },
    [value, onChange]
  );

  useEffect(() => {
    if (!isOpen) return;
  
    globalThis.addEventListener("keydown", handleKeyDown);
  
    return () => {
      globalThis.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, handleKeyDown]);

  return (
    <ObjectMinimizedInput
      properties={property.properties}
      value={value}
      onChange={onChange}
      popoverProps={{
        open: isOpen,
        onClose: () => setIsOpen(false)
      }}
      onClick={() => setIsOpen(true)}
    />
  );
};

export default ObjectInputHandler;
