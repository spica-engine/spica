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
  onValueChange
}) => {
  const handleChange = (value: any) => {
    onValueChange(condition.id, value);
  };

  if (!property || !condition.field) {
    return (
      <Input
        value={condition.value || ""}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="Enter a value"
        dimensionY="fill"
      />
    );
  }

  const InputHandler = filterInputHandlerRegistry.get(property.type);

  if (!InputHandler) {
    return (
      <Input
        value={condition.value || ""}
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
    />
  );
};

export default FilterValueInput;
