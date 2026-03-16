/**
 * @owner Kanan Gasimov
 * email: rio.kenan@gmail.com
 */

import type { Property } from '../../../store/api/bucketApi';

export type ConditionValueType = 
  | 'string'
  | 'number'
  | 'boolean'
  | 'date'
  | 'array'
  | 'object'
  | 'relation'
  | 'generic'
  | 'unknown';

export function mapPropertyTypeToValueType(property?: Property): ConditionValueType {
  if (!property) {
    return 'unknown';
  }

  switch (property.type) {
    case 'string':
    case 'textarea':
    case 'richtext':
      return 'string';
    
    case 'number':
      return 'number';
    
    case 'boolean':
      return 'boolean';
    
    case 'date':
      return 'date';
    
    case 'array':
      return 'array';
    
    case 'object':
      return 'object';
    
    case 'relation':
      return 'relation';
    
    case 'location':
    case 'color':
    case 'storage':
    default:
      return 'generic';
  }
}

export function getEmptyValueForType(valueType: ConditionValueType): any {
  switch (valueType) {
    case 'string':
      return '';
    
    case 'number':
      return '';
    
    case 'boolean':
      return false;
    
    case 'date':
      return '';
    
    case 'array':
      return [];
    
    case 'object':
      return {};
    
    case 'relation':
      return '';
    
    case 'generic':
    case 'unknown':
    default:
      return '';
  }
}

