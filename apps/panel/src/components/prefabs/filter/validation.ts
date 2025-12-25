/**
 * @owner Kanan Gasimov
 * email: rio.kenan@gmail.com
 */

import type { FilterCondition } from './inputHandlers/types';
import type { Property } from '../../../store/api/bucketApi';

function isValidString(value: any): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function isValidNumber(value: any): boolean {
  return value !== null && value !== undefined && value !== "";
}

function isValidBoolean(value: any): boolean {
  return typeof value === "boolean";
}

function isValidDate(value: any): boolean {
  if (value instanceof Date) {
    return true;
  }
  return typeof value === "string" && value.trim().length > 0;
}

function isValidArray(value: any): boolean {
  return Array.isArray(value) && value.length > 0;
}

function isValidObject(value: any): boolean {
  if (value == null) {
    return false;
  }
  if (typeof value === "object" && !Array.isArray(value)) {
    return Object.keys(value).length > 0;
  }
  return true;
}

function hasValidIdProperty(obj: any, idKey: string): boolean {
  return typeof obj[idKey] === "string" && obj[idKey].trim().length > 0;
}

function isValidRelation(value: any): boolean {
  if (typeof value === "string") {
    return value.trim().length > 0;
  }
  
  if (typeof value !== "object" || value == null) {
    return false;
  }
  
  if (value.kind === "id" && hasValidIdProperty(value, "id")) {
    return true;
  }
  
  if (hasValidIdProperty(value, "_id")) {
    return true;
  }
  
  return hasValidIdProperty(value, "id");
}

function isValidGeneric(value: any): boolean {
  return value != null && value !== "";
}

function validateByType(value: any, propertyType: string): boolean {
  switch (propertyType) {
    case "string":
    case "textarea":
    case "richtext":
      return isValidString(value);
    case "number":
      return isValidNumber(value);
    case "boolean":
      return isValidBoolean(value);
    case "date":
      return isValidDate(value);
    case "array":
      return isValidArray(value);
    case "object":
    case "json":
      return isValidObject(value);
    case "relation":
      return isValidRelation(value);
    case "location":
    case "color":
    default:
      return isValidGeneric(value);
  }
}

export function isConditionComplete(
  condition: FilterCondition,
  property?: Property
): boolean {
  if (!condition.field || condition.field.trim().length === 0) {
    return false;
  }

  const value = condition.value;

  if (!property) {
    return isValidGeneric(value);
  }

  return validateByType(value, property.type);
}

export function getCompleteConditions(
  conditions: FilterCondition[],
  bucketProperties: Record<string, Property>
): FilterCondition[] {
  return conditions.filter(condition => {
    const property = condition.field ? bucketProperties[condition.field] : undefined;
    return isConditionComplete(condition, property);
  });
}


export function canAddCondition(
  conditions: FilterCondition[],
  bucketProperties: Record<string, Property>
): boolean {
  const completeCount = getCompleteConditions(conditions, bucketProperties).length;
  return completeCount === conditions.length;
}

