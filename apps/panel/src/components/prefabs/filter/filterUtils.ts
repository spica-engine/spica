/**
 * @owner Kanan Gasimov
 * email: rio.kenan@gmail.com
 */

import type { FilterCondition } from './inputHandlers/types';
import { extractRelationId, isRelationSelected } from '../relation-picker/types';

const operatorMap: Record<string, string> = {
  'Equal': '$eq',
  'Not Equal': '$ne',
  'Greater Than': '$gt',
  'Greater Than or Equal': '$gte',
  'Less Than': '$lt',
  'Less Than or Equal': '$lte',
  'Contains': '$regex',
  'Not Contains': '$not',
  'In': '$in',
  'Not In': '$nin',
};

function isPlainObject(value: any): value is Record<string, any> {
  return value !== null && 
         typeof value === 'object' && 
         !Array.isArray(value) && 
         !(value instanceof Date) &&
         Object.prototype.toString.call(value) === '[object Object]';
}


/**
 * Expand object equality filters into dot-notation field comparisons
 * Example: { "obj1": { "$eq": { "key1": "val1", "key2": 123 } } }
 * becomes: { "$and": [ { "obj1.key1": { "$eq": "val1" } }, { "obj1.key2": { "$eq": 123 } } ] }
 * 
 * Note: Values come pre-typed from ObjectMinimizedInput (NumberInput returns numbers, BooleanInput returns booleans, etc.)
 */

function expandObjectEqualityFilter(
  fieldPath: string, 
  operator: string, 
  value: any
): Record<string, any> | null {
  if (operator !== '$eq' || !isPlainObject(value)) {
    return {
      [fieldPath]: {
        [operator]: value
      }
    };
  }

  const entries = Object.entries(value);
  
  if (entries.length === 0) {
    return {
      [fieldPath]: {
        [operator]: value
      }
    };
  }

  if (entries.length === 1) {
    const [key, val] = entries[0];
    return {
      [`${fieldPath}.${key}`]: {
        [operator]: val
      }
    };
  }

  const expandedConditions = entries.map(([key, val]) => {
    return {
      [`${fieldPath}.${key}`]: {
        [operator]: val
      }
    };
  });

  return {
    $and: expandedConditions
  };
}

function extractQueryValue(value: any, isRelationField: boolean): any {
  if (isRelationField) {
    return extractRelationId(value);
  }
  return value;
}

function isRelationFieldValue(value: any): boolean {
  return isRelationSelected(value);
}

function buildConditionObject(
  condition: FilterCondition
): Record<string, any> | null {
  const mongoOperator = operatorMap[condition.operator] || '$eq';
  const isRelation = isRelationFieldValue(condition.value);
  const fieldPath = isRelation ? `${condition.field}._id` : condition.field;
  const queryValue = extractQueryValue(condition.value, isRelation);
  
  if (isRelation && !queryValue) {
    return null;
  }

  if (condition.valueType === 'object' && mongoOperator === '$eq' && isPlainObject(queryValue)) {
    return expandObjectEqualityFilter(fieldPath, mongoOperator, queryValue);
  }
  
  return {
    [fieldPath]: {
      [mongoOperator]: queryValue
    }
  };
}

function buildConditionObjects(
  validConditions: FilterCondition[]
): Record<string, any>[] {
  return validConditions
    .map(buildConditionObject)
    .filter((obj): obj is Record<string, any> => obj !== null);
}

function buildUniformOperatorFilter(conditionObjects: Record<string, any>[], operator: '$and' | '$or'): Record<string, any> {
  return { [operator]: conditionObjects };
}

function buildMixedOperatorFilter(
  validConditions: FilterCondition[],
  conditionObjects: Record<string, any>[]
): Record<string, any> | null {
  const andConditions: Record<string, any>[] = [conditionObjects[0]];
  const orConditions: Record<string, any>[] = [];
  
  validConditions.slice(1).forEach((condition, index) => {
    const conditionObj = conditionObjects[index + 1];
    if (condition.logicalOperator === 'or') {
      orConditions.push(conditionObj);
    } else {
      andConditions.push(conditionObj);
    }
  });
  
  const filterParts: Record<string, any>[] = [];
  if (andConditions.length > 0) {
    filterParts.push(andConditions.length === 1 ? andConditions[0] : { $and: andConditions });
  }
  if (orConditions.length > 0) {
    filterParts.push(orConditions.length === 1 ? orConditions[0] : { $or: orConditions });
  }
  
  return filterParts.length > 1 ? { $and: filterParts } : (filterParts[0] || null);
}

/**
 * Convert filter conditions into MongoDB-compatible filter object
 * 
 * Transforms object equality filters into dot-notation to avoid MongoDB's fragile subdocument matching.
 * Values are already properly typed by the UI input components (NumberInput, BooleanInput, etc.).
 * 
 * @param conditions - Array of filter conditions from the UI
 * @returns MongoDB filter object or null
 */
export function convertConditionsToFilter(
  conditions: FilterCondition[]
): Record<string, any> | null {

  if (!conditions || conditions.length === 0) {
    return null;
  }

  const conditionObjects = buildConditionObjects(conditions);

  if (conditionObjects.length === 0) {
    return null;
  }

  if (conditions.length === 1) {
    return buildUniformOperatorFilter(conditionObjects, '$and');
  }

  const operators = conditions.slice(1).map(c => c.logicalOperator || 'and');
  const allAnd = operators.every(op => op === 'and');
  const allOr = operators.every(op => op === 'or');
  
  if (allAnd) {
    return buildUniformOperatorFilter(conditionObjects, '$and');
  }
  
  if (allOr) {
    return buildUniformOperatorFilter(conditionObjects, '$or');
  }
  
  return buildMixedOperatorFilter(conditions, conditionObjects);
}
