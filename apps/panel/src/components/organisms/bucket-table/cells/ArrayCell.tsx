/**
 * @owner Kanan Gasimov
 * email: rio.kenan@gmail.com
 */

import {ArrayMinimizedInput} from "oziko-ui-kit";
import React from "react";
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
  return (
    <BaseCellRenderer isFocused={isFocused}>
      <ArrayMinimizedInput
        value={value}
        onChange={onChange}
        items={property.items}
        propertyKey={propertyKey}
        childrenProps={{
          dimensionY: 30
        }}
      />
    </BaseCellRenderer>
  );
};
export const ArrayCellKeyboardHandler: CellKeyboardHandler = {
  handleKeyDown: (event, context) => {
    if (event.key === "Enter" || event.key === " ") {
      return true;
    }
    return false;
  }
};
