/**
 * @owner Kanan Gasimov
 * email: rio.kenan@gmail.com
 */

import React, {useState} from "react";
import type {FilterInputHandlerProps} from "./FilterInputHandlerRegistry";
import {ObjectMinimizedInput} from "oziko-ui-kit";

const ObjectInputHandler: React.FC<FilterInputHandlerProps> = ({value, onChange, property}) => {
  const [isOpen, setIsOpen] = useState(false);


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
