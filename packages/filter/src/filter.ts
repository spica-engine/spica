import {ObjectId} from "@spica-server/database";
import {Expression, Extractor, KeyValidator, ValueConstructor} from "./interface";

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

export function replaceFilterObjectIds(filter: object) {
  const keyValidators = [key => key == "_id" || key.endsWith("._id")];
  return Promise.resolve(replaceFilter(filter, keyValidators, ObjectIdIfValid));
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

function constructValue(value: object, ctor: ValueConstructor) {
  // { "key": { ... } }
  if (typeof value == "object") {
    for (let [k, v] of Object.entries(value)) {
      // { "key": { $in: [<value1>,<value2>] } }
      if (typeof v == "object") {
        if (Array.isArray(v)) {
          value[k] = v.map(id => {
            return ctor(id);
          });
        }
      }
      // { "key": { $eq: "<value>" } }
      else if (typeof v == "string") {
        value[k] = ctor(v);
      }
    }
  }
  // { "key": "<value>" }
  else if (typeof value == "string") {
    value = ctor(value);
  }
  return value;
}

function ObjectIdIfValid(val): ValueConstructor<ObjectId> {
  return ObjectId.isValid(val) ? new ObjectId(val) : val;
}
