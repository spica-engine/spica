/**
 * @owner Kanan Gasimov
 * email: rio.kenan@gmail.com
 */

import React from 'react';
import { Input } from 'oziko-ui-kit';
import type { FilterInputHandlerProps } from './FilterInputHandlerRegistry';

const StringInputHandler: React.FC<FilterInputHandlerProps> = ({
  value,
  onChange
}) => {
  return (
    <Input
      value={value || ""}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Enter a value"
      dimensionY="fill"
    />
  );
};

export default StringInputHandler;
