import {ObjectId} from "@spica-server/database";
import {Bucket} from "./bucket";

export function filterReviver(k: string, v: string) {
  const availableConstructors = {
    Date: v => new Date(v),
    ObjectId: v => new ObjectId(v)
  };
  const ctr = /^([a-zA-Z]+)\((.*?)\)$/;
  if (typeof v == "string" && ctr.test(v)) {
    const [, desiredCtr, arg] = v.match(ctr);
    if (availableConstructors[desiredCtr]) {
      return availableConstructors[desiredCtr](arg);
    } else {
      throw new Error(`Could not find the constructor ${desiredCtr} in {"${k}":"${v}"}`);
    }
  }
  return v;
}

export function isJSONFilter(value: any) {
  if (typeof value == "string" && value.trim().length) {
    return value.trim()[0] == "{";
  }
  return false;
}

interface Extractor {
  operators: string[];
  factory: (expression: Expression) => string[][];
}

interface Expression {
  [key: string]: any;
}

export const DefaultExtractor: Extractor = {
  operators: [],
  factory: (expression: Expression) => {
    const map: string[][] = [];
    for (const fields of Object.keys(expression)) {
      const field = fields.split(".");
      map.push(field);
    }
    return map;
  }
};

export const LogicalExtractor: Extractor = {
  operators: ["$or", "$and", "$nor"],
  factory: (expression: Expression) => {
    const maps: string[][] = [];

    const [expressions]: Expression[][] = Object.values(expression);

    for (const expression of expressions) {
      const map = extractFilterPropertyMap(expression);
      maps.push(...map);
    }

    return maps;
  }
};

const extractors = [LogicalExtractor];

export function extractFilterPropertyMap(filter: object) {
  const maps: string[][] = [];

  for (const [key, value] of Object.entries(filter)) {
    let extractor = extractors.find(extractor => extractor.operators.some(ekey => ekey == key));

    if (!extractor) {
      extractor = DefaultExtractor;
    }

    const expression = {[key]: value};

    const map = extractor.factory(expression);

    maps.push(...map);
  }
  return maps;
}

export function replaceFilter(
  filter: object,
  keyValidators: KeyValidator[],
  valueConstructor: ValueConstructor
) {
  for (let [key, value] of Object.entries(filter)) {
    // run recursively for each logical operators such as { $or : [ { expression1 } ,{ expression2 } ] }
    if (LogicalExtractor.operators.includes(key)) {
      value = value.map(expression => replaceFilter(expression, keyValidators, valueConstructor));
    }
    if (keyValidators.some(validator => !validator(key))) {
      continue;
    }

    value = constructValue(value, valueConstructor);

    filter[key] = value;
  }
  return filter;
}

export function replaceFilterObjectIds(filter: object) {
  const keyValidators = [key => key == "_id" || key.endsWith("._id")];
  return replaceFilter(filter, keyValidators, ObjectIdIfValid);
}

export function replaceFilterDates(filter: object, bucket: Bucket) {
  const keyValidators = [
    key => !!bucket.properties[key],
    key => bucket.properties[key].type == "date"
  ];
  return replaceFilter(filter, keyValidators, DateIfValid);
}

export function constructValue(value: object, ctor: ValueConstructor) {
  // { "_id": { ... } }
  if (typeof value == "object") {
    for (let [k, v] of Object.entries(value)) {
      // { "_id": { $in: [...] } }
      if (typeof v == "object") {
        if (Array.isArray(v)) {
          value[k] = v.map(id => {
            return ctor(id);
          });
        }
      }
      // { "_id": { $eq: "<id>" } }
      else if (typeof v == "string") {
        value[k] = ctor(v);
      }
    }
  }
  // { "_id": "<id>" }
  else if (typeof value == "string") {
    value = ctor(value);
  }
  return value;
}

function ObjectIdIfValid(val): ValueConstructor<ObjectId> {
  return ObjectId.isValid(val) ? new ObjectId(val) : val;
}

function DateIfValid(val): ValueConstructor<Date> {
  return !isNaN(Date.parse(val)) ? new Date(val) : val;
}

export type KeyValidator = (key: string) => boolean;
export type ValueConstructor<NewType = any> = (val) => NewType;
