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
 */

type MongoFilter = Record<string, any>;

function expandObjectEqualityFilter(
  fieldPath: string,
  operator: string,
  value: unknown
): MongoFilter {
  const leaf = (path: string, v: unknown): MongoFilter => ({
    [path]: { [operator]: v }
  });


  if (operator !== "$eq" || !isPlainObject(value)) {
    return leaf(fieldPath, value);
  }

  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length === 0) {

    return leaf(fieldPath, value);
  }


  const expanded = entries.map(([key, v]) => leaf(`${fieldPath}.${key}`, v));


  if (expanded.length === 1) return expanded[0];


  return { $and: expanded };
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

export function convertConditionsToFilter(
  conditions: FilterCondition[]
): Record<string, any> | null {
  if (!conditions?.length) return null;

  const conditionObjects = buildConditionObjects(conditions);
  if (!conditionObjects.length) return null;

  if (conditions.length === 1) {
    return buildUniformOperatorFilter(conditionObjects, "$and");
  }

  const ops = conditions
    .slice(1)
    .map(c => (c.logicalOperator ?? "and").toLowerCase());

  const isAll = (v: string) => ops.every(op => op === v);

  if (isAll("and")) return buildUniformOperatorFilter(conditionObjects, "$and");
  if (isAll("or")) return buildUniformOperatorFilter(conditionObjects, "$or");

  return buildMixedOperatorFilter(conditions, conditionObjects);
}
