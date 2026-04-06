/**
 * @owner Kanan Gasimov
 * email: rio.kenan@gmail.com
 */

import type { Property } from '../../../../store/api/bucketApi';
import type { FilterCondition } from './types';

export type FilterInputHandlerProps = {
  condition: FilterCondition;
  property: Property;
  value: any;
  onChange: (value: any) => void;
  onOperatorChange?: (operator: string) => void;
};

export type FilterInputHandler = React.ComponentType<FilterInputHandlerProps>;

type FilterInputHandlerRegistry = Map<string, FilterInputHandler>;

class FilterInputHandlerRegistryClass {
  private readonly registry: FilterInputHandlerRegistry = new Map();
  private defaultHandler?: FilterInputHandler;

  register(type: string, handler: FilterInputHandler): void {
    this.registry.set(type, handler);
  }

  registerDefault(handler: FilterInputHandler): void {
    this.defaultHandler = handler;
  }

  get(type: string): FilterInputHandler | undefined {
    return this.registry.get(type) || this.defaultHandler;
  }

  has(type: string): boolean {
    return this.registry.has(type);
  }
}

export const filterInputHandlerRegistry = new FilterInputHandlerRegistryClass();
