/**
 * @owner Kanan Gasimov
 * email: rio.kenan@gmail.com
 */

import React from 'react';
import { NumberMinimizedInput } from 'oziko-ui-kit';
import type { FilterInputHandlerProps } from './FilterInputHandlerRegistry';

const NumberInputHandler: React.FC<FilterInputHandlerProps> = ({
  value,
  onChange
}) => {
  return (
    <NumberMinimizedInput
      value={value}
      onChange={onChange}
    />
  );
};

export default NumberInputHandler;
