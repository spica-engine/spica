import {Bucket, BucketPreferences, BucketDocument} from "../services";
import {ObjectId} from "@spica-server/database";
import {findLocale, hasTranslatedProperties, buildI18nAggregation} from "./locale";
import * as ACL from "../expression";
import {
  createRelationMap,
  getRelationPipeline,
  resetNonOverlappingPathsInRelationMap
} from "./relation";
import {ForbiddenException} from "@nestjs/common";
import {getUpdateQueryForPatch} from "./patch";

export async function findDocuments(
  schema: Bucket,
  params: {
    resourceFilter?: object;
    filter?: object;
    language?: string;
    relationPaths: string[][];
    req: any;
    sort?: object;
    skip?: number;
    limit?: number;
    projectMap: string[][];
  },
  options: {
    schedule?: boolean;
    localize?: boolean;
    paginate?: boolean;
  },
  factories: {
    collection: (id: string | ObjectId) => any;
    preference: () => Promise<BucketPreferences>;
    schema: (id: string | ObjectId) => Promise<Bucket>;
  }
) {
  const collection = factories.collection(schema._id);

  const aggregations = [];

  // resourcefilter
  if (Object.keys(params.resourceFilter || {}).length) {
    aggregations.push(params.resourceFilter);
  }

  // scheduled contents
  if (!options.schedule) {
    aggregations.push({$match: {_schedule: {$exists: false}}});
  }

  //localization
  const locale = findLocale(params.language, await factories.preference());
  if (options.localize && hasTranslatedProperties(schema.properties)) {
    aggregations.push({
      $replaceWith: buildI18nAggregation("$$ROOT", locale.best, locale.fallback)
    });

    params.req.res.header("Content-language", locale.best || locale.fallback);
  }

  // rules
  const propertyMap = ACL.extractPropertyMap(schema.acl.read).map(path => path.split("."));

  const relationMap = await createRelationMap({
    paths: [...params.relationPaths, ...propertyMap],
    properties: schema.properties,
    resolve: factories.schema
  });

  const relationStage = getRelationPipeline(relationMap, locale);
  aggregations.push(...relationStage);

  const match = ACL.aggregate(schema.acl.read, {auth: params.req.user});
  aggregations.push({$match: match});

  const resetStage = resetNonOverlappingPathsInRelationMap({
    left: params.relationPaths,
    right: propertyMap,
    map: relationMap
  });

  if (resetStage) {
    // Reset those relations which have been requested by acl rules.
    aggregations.push(resetStage);
  }

  // filter
  if (Object.keys(params.filter || {}).length) {
    aggregations.push({$match: params.filter});
  }

  // for graphql responses
  if (params.projectMap.length) {
    aggregations.push(getProjectAggregation(params.projectMap));
  }

  // sort,skip and limit
  const seekingPipeline = [];

  if (Object.keys(params.sort || {}).length) {
    seekingPipeline.push({$sort: params.sort});
  }

  if (params.skip) {
    seekingPipeline.push({$skip: params.skip});
  }

  if (params.limit) {
    seekingPipeline.push({$limit: params.limit});
  }

  if (options.paginate) {
    aggregations.push(
      {
        $facet: {
          meta: [{$count: "total"}],
          data: seekingPipeline.length ? seekingPipeline : [{$unwind: "$_id"}]
        }
      },
      {$unwind: {path: "$meta", preserveNullAndEmptyArrays: true}}
    );

    const result = await collection.aggregate(aggregations).next();

    return result.data.length ? result : {meta: {total: 0}, data: []};
  }

  return collection.aggregate([...aggregations, ...seekingPipeline]).toArray();
}

export async function insertDocument(
  schema: Bucket,
  document: BucketDocument,
  params: {
    req: any;
  },
  factories: {
    collection: (id: string | ObjectId) => any;
    schema: (id: string | ObjectId) => Promise<Bucket>;
  }
) {
  const collection = factories.collection(schema._id);

  const ruleAggregation = await getWriteRuleAggregation(schema, factories.schema, document);

  const fullDocument = await collection
    // unlike others, we have to run this pipeline against buckets in case the target
    // collection is empty.
    .collection("buckets")
    .aggregate(ruleAggregation)
    .next();

  const aclResult = ACL.run(schema.acl.write, {auth: params.req.user, document: fullDocument});
  if (!aclResult) {
    throw new ForbiddenException("ACL rules has rejected this operation.");
  }

  return collection.insertOne(document);
}

export async function replaceDocument(
  schema: Bucket,
  document: BucketDocument,
  params: {
    req: any;
  },
  factories: {
    collection: (id: string | ObjectId) => any;
    schema: (id: string | ObjectId) => Promise<Bucket>;
  },
  options: {
    returnOriginal: boolean;
  } = {returnOriginal: true}
) {
  const collection = factories.collection(schema._id);

  const ruleAggregation = await getWriteRuleAggregation(schema, factories.schema, document);

  const fullDocument = await collection.aggregate(ruleAggregation).next();

  const aclResult = ACL.run(schema.acl.write, {auth: params.req.user, document: fullDocument});

  if (!aclResult) {
    throw new ForbiddenException("ACL rules has rejected this operation.");
  }

  const documentId = document._id;
  delete document._id;

  return collection.findOneAndReplace({_id: documentId}, document, {
    returnOriginal: options.returnOriginal
  });
}

export async function patchDocument(
  schema: Bucket,
  document: BucketDocument,
  patch: any,
  params: {
    req: any;
  },
  factories: {
    collection: (id: string | ObjectId) => any;
    schema: (id: string | ObjectId) => Promise<Bucket>;
  },
  options: {
    returnOriginal: boolean;
  } = {returnOriginal: true}
) {
  const collection = factories.collection(schema._id);

  const ruleAggregation = await getWriteRuleAggregation(schema, factories.schema, document);

  const fullDocument = await collection.aggregate(ruleAggregation).next();

  const aclResult = ACL.run(schema.acl.write, {auth: params.req.user, document: fullDocument});

  if (!aclResult) {
    throw new ForbiddenException("ACL rules has rejected this operation.");
  }

  const updateQuery = getUpdateQueryForPatch(patch);

  return collection.findOneAndUpdate({_id: document._id}, updateQuery, {
    returnOriginal: options.returnOriginal
  });
}

export async function deleteDocument(
  schema: Bucket,
  documentId: ObjectId,
  params: {
    req: any;
  },
  factories: {
    collection: (id: string | ObjectId) => any;
    schema: (id: string | ObjectId) => Promise<Bucket>;
  }
) {
  const collection = factories.collection(schema._id);

  const document = collection.findOne({_id: new ObjectId(documentId)});

  const ruleAggregation = await getWriteRuleAggregation(schema, factories.schema, document);

  const fullDocument = await collection.aggregate(ruleAggregation).next();

  const aclResult = ACL.run(schema.acl.write, {auth: params.req.user, document: fullDocument});

  if (!aclResult) {
    throw new ForbiddenException("ACL rules has rejected this operation.");
  }

  const deletedCount = await collection.deleteOne({_id: documentId});

  if (deletedCount == 1) {
    return document;
  }
}

async function getWriteRuleAggregation(schema: Bucket, resolve: any, document: BucketDocument) {
  const paths = ACL.extractPropertyMap(schema.acl.write).map(path => path.split("."));

  const relationMap = await createRelationMap({
    properties: schema.properties,
    paths,
    resolve: resolve
  });

  const relationStage = getRelationPipeline(relationMap, undefined);

  return [
    {$limit: 1},
    {
      $replaceWith: document
    },
    ...relationStage
  ];
}

function getProjectAggregation(fieldMap: string[][]) {
  const result = {};
  for (const fields of fieldMap) {
    result[fields.join(".")] = 1;
  }
  return {$project: result};
}
