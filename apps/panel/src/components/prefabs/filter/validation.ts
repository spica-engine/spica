/**
 * @owner Kanan Gasimov
 * email: rio.kenan@gmail.com
 */

import type { FilterCondition } from './inputHandlers/types';
import type { ConditionValueType } from './conditionValueType';


function isValidString(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}


function isValidNumber(value: unknown): boolean {
  return typeof value === "number" && !Number.isNaN(value);
}

function isValidBoolean(value: unknown): boolean {
  return typeof value === "boolean";
}

function isValidDate(value: unknown): boolean {
  if (value instanceof Date) {
    return !Number.isNaN(value.getTime());
  }
  return typeof value === "string" && value.trim().length > 0;
}

function isValidArray(value: unknown): boolean {
  return Array.isArray(value) && value.length > 0;
}

function isValidObject(value: unknown): boolean {
  if (value == null) {
    return false;
  }
  if (typeof value === "object" && !Array.isArray(value)) {
    return Object.keys(value).length > 0;
  }
  return false;
}

function hasValidIdProperty(obj: any, idKey: string): boolean {
  return typeof obj[idKey] === "string" && obj[idKey].trim().length > 0;
}

function isValidRelation(value: unknown): boolean {
  if (typeof value === "string") {
    return value.trim().length > 0;
  }
  
  if (typeof value !== "object" || value == null) {
    return false;
  }
  
  const obj = value as any;
  
  if (obj.kind === "id" && hasValidIdProperty(obj, "id")) {
    return true;
  }
  
  if (hasValidIdProperty(obj, "_id")) {
    return true;
  }
  
  return hasValidIdProperty(obj, "id");
}

function isValidGeneric(value: unknown): boolean {
  return value != null && value !== "";
}

const validatorsByValueType: Record<ConditionValueType, (value: unknown) => boolean> = {
  string: isValidString,
  number: isValidNumber,
  boolean: isValidBoolean,
  date: isValidDate,
  array: isValidArray,
  object: isValidObject,
  relation: isValidRelation,
  generic: isValidGeneric,
  unknown: isValidGeneric,
};

export function isConditionComplete(condition: FilterCondition): boolean {
  if (!condition.field || condition.field.trim().length === 0) {
    return false;
  }

  const validator = validatorsByValueType[condition.valueType];
  if (!validator) {
    return isValidGeneric(condition.value);
  }

  return validator(condition.value);
}

export function getCompleteConditions(
  conditions: FilterCondition[]
): FilterCondition[] {
  return conditions.filter(isConditionComplete);
}


export function canAddCondition(
  conditions: FilterCondition[]
): boolean {
  const completeCount = getCompleteConditions(conditions).length;
  return completeCount === conditions.length;
}

