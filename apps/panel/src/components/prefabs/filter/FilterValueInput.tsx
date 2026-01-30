/**
 * @owner Kanan Gasimov
 * email: rio.kenan@gmail.com
 */

import React from 'react';
import { Input } from 'oziko-ui-kit';
import { filterInputHandlerRegistry } from './inputHandlers/FilterInputHandlerRegistry';
import type { FilterValueInputProps } from './inputHandlers/types';
import './inputHandlers'; 

const FilterValueInput: React.FC<FilterValueInputProps> = ({
  condition,
  property,
  onValueChange,
  onOperatorChange
}) => {
  const handleChange = (value: any) => {
    onValueChange(condition.id, value);
  };

  const handleOperatorChange = (operator: string) => {
    if (onOperatorChange) {
      onOperatorChange(condition.id, operator);
    }
  };

  const InputHandler = filterInputHandlerRegistry.get(condition.valueType);

  if (!InputHandler || !property) {
    let displayValue = '';
    if (typeof condition.value === 'string') {
      displayValue = condition.value;
    } else if (typeof condition.value === 'number') {
      displayValue = String(condition.value);
    }
    
    return (
      <Input
        value={displayValue}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="Enter value"
        dimensionY="fill"
      />
    );
  }

  return (
    <InputHandler
      condition={condition}
      property={property}
      value={condition.value}
      onChange={handleChange}
      onOperatorChange={handleOperatorChange}
    />
  );
};

export default FilterValueInput;
