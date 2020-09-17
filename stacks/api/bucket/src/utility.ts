import {ObjectId} from "@spica-server/database";
import {getBucketDataCollection, BucketDataService} from "./bucket-data.service";
import {buildI18nAggregation, Locale} from "./locale";
import {BucketService} from "../services";
import {diff, ChangeKind} from "../history/differ";

export function findRelations(
  schema: any,
  bucketId: string,
  path: string = "",
  targets: Map<string, "onetoone" | "onetomany">
) {
  path = path ? `${path}.` : ``;
  for (const field of Object.keys(schema)) {
    if (isObject(schema[field])) {
      findRelations(schema[field].properties, bucketId, `${path}${field}`, targets);
    } else if (isRelation(schema[field], bucketId)) {
      targets.set(`${path}${field}`, schema[field].relationType);
    }
  }
  return targets;
}

export function findUpdatedFields(
  previousSchema: any,
  currentSchema: any,
  updatedFields: string[],
  path: string
) {
  for (const field of Object.keys(previousSchema)) {
    if (
      !currentSchema.hasOwnProperty(field) ||
      currentSchema[field].type != previousSchema[field].type
    ) {
      updatedFields.push(path ? `${path}.${field}` : field);
      //we dont need to check child keys of this key anymore
      continue;
    }
    if (isObject(previousSchema[field]) && isObject(currentSchema[field])) {
      findUpdatedFields(
        previousSchema[field].properties,
        currentSchema[field].properties,
        updatedFields,
        path ? `${path}.${field}` : field
      );
    } else if (isArray(previousSchema[field]) && isArray(currentSchema[field])) {
      addArrayPattern(
        previousSchema[field].items,
        currentSchema[field].items,
        updatedFields,
        path ? `${path}.${field}` : field
      );
    }
  }
  return updatedFields;
}

export function addArrayPattern(
  previousSchema: any,
  currentSchema: any,
  updatedFields: string[],
  path: string
) {
  path = `${path}.$[]`;
  if (isArray(previousSchema) && isArray(currentSchema)) {
    addArrayPattern(previousSchema.items, currentSchema.items, updatedFields, path);
  } else if (isObject(previousSchema) && isObject(currentSchema)) {
    findUpdatedFields(previousSchema.properties, currentSchema.properties, updatedFields, path);
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

export function provideLanguageChangeUpdater(
  bucketService: BucketService,
  bucketDataService: BucketDataService
) {
  return (previousSchema: object, currentSchema: object) => {
    let changes = diff(previousSchema, currentSchema);
    let deletedLanguages = changes
      .filter(
        change =>
          change.kind == ChangeKind.Delete &&
          change.path[0] == "language" &&
          change.path[1] == "available"
      )
      .map(change => change.path[2]);

    if (!deletedLanguages.length) {
      return Promise.resolve();
    }

    return bucketService
      .aggregate([
        {
          $project: {
            properties: {
              $objectToArray: "$properties"
            }
          }
        },
        {
          $match: {
            "properties.v.options.translate": true
          }
        },
        {
          $project: {
            properties: {
              $filter: {
                input: "$properties",
                as: "property",
                cond: {$eq: ["$$property.v.options.translate", true]}
              }
            }
          }
        },
        {
          $project: {
            properties: {
              $arrayToObject: "$properties"
            }
          }
        }
      ])
      .toArray()
      .then(buckets =>
        buckets.map(bucket => {
          let targets = {};

          Object.keys(bucket.properties).forEach(field => {
            targets = deletedLanguages.reduce((acc, language) => {
              acc = {...acc, [`${field}.${language}`]: ""};
              return acc;
            }, targets);
          });

          return bucketDataService.updateMany(bucket._id, {}, {$unset: targets});
        })
      );
  };
}
