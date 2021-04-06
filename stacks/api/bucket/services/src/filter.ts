import {ObjectId} from "@spica-server/database";

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
