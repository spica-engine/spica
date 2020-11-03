import {ObjectId} from "@spica-server/database";
import {getBucketDataCollection, BucketDataService} from "./bucket-data.service";
import {buildI18nAggregation, Locale} from "./locale";
import {diff, ChangeKind, ChangePaths} from "../history/differ";
import {BucketService, BucketDocument, Bucket} from "@spica-server/bucket/services";
import {HistoryService} from "@spica-server/bucket/history";
const JsonMergePatch = require("json-merge-patch");

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

export async function getRelationAggregation(
  properties: object,
  fields: string[][],
  locale: Locale,
  getSchema: (bucketId: string) => Promise<Bucket>
) {
  let aggregations = [];
  for (const [key, value] of Object.entries(properties)) {
    if (value.type == "relation") {
      let relateds = fields.filter(field => field[0] == key);
      if (relateds.length) {
        let aggregation = buildRelationAggregation(key, value.bucketId, value.relationType, locale);

        let relatedBucket = await getSchema(value.bucketId);

        //Remove first key to continue recursive lookup
        relateds = relateds.map(field => field.slice(1));

        let innerLookup = await getRelationAggregation(
          relatedBucket.properties,
          relateds,
          locale,
          getSchema
        );

        aggregation[0].$lookup.pipeline.push(...innerLookup);

        aggregations.push(...aggregation);
      }
    }
  }
  return aggregations;
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
  return async (previousSchema: object, currentSchema: object) => {
    let deletedLanguages = diff(previousSchema, currentSchema)
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

    let buckets = await bucketService
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
      .toArray();

    let promises = buckets.map(bucket => {
      let targets = {};

      Object.keys(bucket.properties).forEach(field => {
        targets = deletedLanguages.reduce((acc, language) => {
          acc = {...acc, [`${field}.${language}`]: ""};
          return acc;
        }, targets);
      });

      return bucketDataService.updateMany(bucket._id, {}, {$unset: targets});
    });

    return Promise.all(promises);
  };
}

export async function clearRelations(
  bucketService: BucketService,
  bucketId: ObjectId,
  documentId: ObjectId
) {
  let buckets = await bucketService.find({_id: {$ne: bucketId}});
  if (buckets.length < 1) return;

  for (const bucket of buckets) {
    let targets = findRelations(bucket.properties, bucketId.toHexString(), "", new Map());
    if (targets.size < 1) continue;

    for (const [target, type] of targets.entries()) {
      const updateParams = getUpdateParams(target, type, documentId.toHexString());
      await bucketService
        .collection(`bucket_${bucket._id.toHexString()}`)
        .updateMany(updateParams.filter, updateParams.update);
    }
  }
}

export function createHistory(
  bs: BucketService,
  history: HistoryService,
  bucketId: ObjectId,
  previousDocument: BucketDocument,
  currentDocument: BucketDocument
) {
  return bs.findOne({_id: bucketId}).then(bucket => {
    if (bucket && bucket.history) {
      return history.createHistory(bucketId, previousDocument, currentDocument);
    }
  });
}

export function getPatchedDocument(previousDocument: BucketDocument, patchQuery: any) {
  delete previousDocument._id;
  delete patchQuery._id;

  return JsonMergePatch.apply(JSON.parse(JSON.stringify(previousDocument)), patchQuery);
}

export function getUpdateQuery(previousDocument: BucketDocument, currentDocument: BucketDocument) {
  let updateQuery: any = {};

  let changes = diff(previousDocument, currentDocument);

  changes = changes.map(change => {
    let numIndex = change.path.findIndex(t => typeof t == "number");
    //item update is not possible with merge/patch,
    //we must put the given array directly
    if (numIndex > 0) {
      //if paths include array index, the last path before any number is the array path that will be put
      //we do not need to track rest of it
      change.path = change.path.slice(0, numIndex);
      //array updates will be handled with set operator.
      change.kind = ChangeKind.Edit;
    }
    return change;
  });

  const setTargets = changes
    .filter(change => change.kind != ChangeKind.Delete)
    .map(change => change.path);
  let setExpressions = createExpressionFromChange(currentDocument, setTargets, "set");
  if (Object.keys(setExpressions).length) {
    updateQuery.$set = setExpressions;
  }

  const unsetTargets = changes
    .filter(change => change.kind == ChangeKind.Delete)
    .map(change => change.path);
  let unsetExpressions = createExpressionFromChange(currentDocument, unsetTargets, "unset");
  if (Object.keys(unsetExpressions).length) {
    updateQuery.$unset = unsetExpressions;
  }

  return updateQuery;
}

function createExpressionFromChange(
  document: BucketDocument,
  targets: ChangePaths[],
  operation: "set" | "unset"
) {
  let expressions = {};
  targets.forEach(target => {
    let key = target.join(".");
    let value = "";

    if (operation == "set") {
      value = findValueOfPath(target, document);
    }

    expressions[key] = value;
  });

  return expressions;
}

function findValueOfPath(path: (string | number)[], document: BucketDocument) {
  return path.reduce((document, name) => document[name], document);
}

export function deepCopy(value: unknown) {
  return JSON.parse(JSON.stringify(value));
}
