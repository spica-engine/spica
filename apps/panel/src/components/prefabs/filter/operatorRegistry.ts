/**
 * @owner Kanan Gasimov
 * email: rio.kenan@gmail.com
 */

import type { ConditionValueType } from './conditionValueType';

export type OperatorOption = {
  label: string;
  value: string;
};

export type OperatorConfig = {
  options: OperatorOption[];
  defaultOperator: string;
  isEditable: boolean; // Whether to show as Select (true) or span (false)
};

/**
 * Registry of operators for different field value types
 * This makes it easy to add new operators for any field type
 */
const operatorRegistry: Record<ConditionValueType, OperatorConfig> = {
  array: {
    isEditable: true,
    defaultOperator: 'Include All',
    options: [
      { label: 'Include All', value: 'Include All' },
      { label: 'Include One', value: 'Include One' },
      { label: 'Not Include', value: 'Not Include' },
    ],
  },
  
  string: {
    isEditable: false,
    defaultOperator: 'Equal',
    options: [
      { label: 'Equal', value: 'Equal' },
    ],
  },
  
  number: {
    isEditable: false,
    defaultOperator: 'Equal',
    options: [
      { label: 'Equal', value: 'Equal' },
    ],
  },
  
  boolean: {
    isEditable: false,
    defaultOperator: 'Equal',
    options: [
      { label: 'Equal', value: 'Equal' },
    ],
  },
  
  date: {
    isEditable: false,
    defaultOperator: 'Equal',
    options: [
      { label: 'Equal', value: 'Equal' },
    ],
  },
  
  object: {
    isEditable: false,
    defaultOperator: 'Equal',
    options: [
      { label: 'Equal', value: 'Equal' },
    ],
  },
  
  relation: {
    isEditable: false,
    defaultOperator: 'Equal',
    options: [
      { label: 'Equal', value: 'Equal' },
    ],
  },
  
  generic: {
    isEditable: false,
    defaultOperator: 'Equal',
    options: [
      { label: 'Equal', value: 'Equal' },
    ],
  },
  
  unknown: {
    isEditable: false,
    defaultOperator: 'Equal',
    options: [
      { label: 'Equal', value: 'Equal' },
    ],
  },
};

/**
 * Get operator configuration for a specific value type
 */
export function getOperatorConfig(valueType: ConditionValueType): OperatorConfig {
  return operatorRegistry[valueType] || operatorRegistry.unknown;
}

/**
 * Get the default operator for a specific value type
 */
export function getDefaultOperator(valueType: ConditionValueType): string {
  return getOperatorConfig(valueType).defaultOperator;
}

/**
 * Get operator options for a specific value type (if editable)
 */
export function getOperatorOptions(valueType: ConditionValueType): OperatorOption[] | null {
  const config = getOperatorConfig(valueType);
  return config.isEditable ? config.options : null;
}

/**
 * Check if operator is editable for a specific value type
 */
export function isOperatorEditable(valueType: ConditionValueType): boolean {
  return getOperatorConfig(valueType).isEditable;
}

