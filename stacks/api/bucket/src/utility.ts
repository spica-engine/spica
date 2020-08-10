import {ObjectId} from "@spica-server/database";
import {getBucketDataCollection} from "./bucket-data.service";
import {buildI18nAggregation, Locale} from "./locale";

export function findRelations(
  schema: any,
  bucketId: string,
  path: string = "",
  targets: Map<string, "onetoone" | "onetomany">
) {
  path = path ? `${path}.` : ``;
  for (const key of Object.keys(schema)) {
    if (isObject(schema[key])) {
      findRelations(schema[key].properties, bucketId, `${path}${key}`, targets);
    } else if (isRelation(schema[key], bucketId)) {
      targets.set(`${path}${key}`, schema[key].relationType);
    }
  }
  return targets;
}

export function findRemovedKeys(
  previousSchema: any,
  currentSchema: any,
  removedKeys: string[],
  path: string
) {
  for (const key of Object.keys(previousSchema)) {
    if (!currentSchema.hasOwnProperty(key)) {
      removedKeys.push(path ? `${path}.${key}` : key);
      //we dont need to check child keys of this key anymore
      continue;
    }
    if (isObject(previousSchema[key]) && isObject(currentSchema[key])) {
      findRemovedKeys(
        previousSchema[key].properties,
        currentSchema[key].properties,
        removedKeys,
        path ? `${path}.${key}` : key
      );
    } else if (isArray(previousSchema[key]) && isArray(currentSchema[key])) {
      addArrayPattern(
        previousSchema[key].items,
        currentSchema[key].items,
        removedKeys,
        path ? `${path}.${key}` : key
      );
    }
  }
  return removedKeys;
}

export function addArrayPattern(
  previousSchema: any,
  currentSchema: any,
  removedKeys: string[],
  path: string
) {
  path = `${path}.$[]`;
  if (isArray(previousSchema) && isArray(currentSchema)) {
    addArrayPattern(previousSchema.items, currentSchema.items, removedKeys, path);
  } else if (isObject(previousSchema) && isObject(currentSchema)) {
    findRemovedKeys(previousSchema.properties, currentSchema.properties, removedKeys, path);
  }
}

export function getUpdateParams(
  target: string,
  type: "onetoone" | "onetomany",
  documentId: string
): {filter: object; update: object} {
  if (type == "onetoone") {
    return {filter: {[target]: documentId}, update: {$unset: {[target]: ""}}};
  } else if ((type = "onetomany")) {
    return {
      filter: {[target]: {$in: [documentId]}},
      update: {$pull: {[target]: documentId}}
    };
  }
}

export function isObject(schema: any) {
  return schema.type == "object";
}

export function isRelation(schema: any, bucketId: string) {
  return schema.type == "relation" && schema.bucketId == bucketId;
}

export function isArray(schema: any) {
  return schema.type == "array";
}

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

export function buildRelationAggregation(
  property: string,
  bucketId: string,
  type: "onetomany" | "onetoone",
  locale: Locale
) {
  if (type == "onetomany") {
    return [
      {
        $lookup: {
          from: getBucketDataCollection(bucketId),
          let: {
            documentIds: {
              $ifNull: [
                {
                  $map: {
                    input: `$${property}`,
                    in: {$toObjectId: "$$this"}
                  }
                },
                []
              ]
            }
          },
          pipeline: [
            {$match: {$expr: {$in: ["$_id", "$$documentIds"]}}},
            locale
              ? {$replaceWith: buildI18nAggregation("$$ROOT", locale.best, locale.fallback)}
              : undefined,
            {$set: {_id: {$toString: "$_id"}}}
          ].filter(Boolean),
          as: property
        }
      }
    ];
  } else {
    return [
      {
        $lookup: {
          from: getBucketDataCollection(bucketId),
          let: {
            documentId: {
              $toObjectId: `$${property}`
            }
          },
          pipeline: [
            {$match: {$expr: {$eq: ["$_id", "$$documentId"]}}},
            locale
              ? {$replaceWith: buildI18nAggregation("$$ROOT", locale.best, locale.fallback)}
              : undefined,
            {$set: {_id: {$toString: "$_id"}}}
          ].filter(Boolean),
          as: property
        }
      },
      {$unwind: {path: `$${property}`, preserveNullAndEmptyArrays: true}}
    ];
  }
}
