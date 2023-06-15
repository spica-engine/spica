import {schemaDiff, ChangeKind} from "@spica-server/core/differ";
import {findRelations} from "@spica-server/bucket/common";
import {Bucket, BucketDataService, BucketService} from "@spica-server/bucket/services";
import {ObjectId} from "@spica-server/database";
import {HistoryService} from "@spica-server/bucket/history";
import * as expression from "@spica-server/bucket/expression";
import {BadRequestException} from "@nestjs/common";
import {deepCopy} from "@spica-server/core/patch";

export async function insert(bs: BucketService, bucket: Bucket) {
  ruleValidation(bucket);

  if (bucket._id) {
    bucket._id = new ObjectId(bucket._id);
  }

  await bs.insertOne(bucket);

  bs.emitSchemaChanges();

  return bucket;
}

export async function replace(
  bs: BucketService,
  bds: BucketDataService,
  history: HistoryService,
  bucket: Bucket
) {
  ruleValidation(bucket);

  const _id = new ObjectId(bucket._id);
  delete bucket._id;

  const previousSchema = await bs.findOne({_id});

  const currentSchema = await bs.findOneAndReplace({_id}, bucket, {
    returnOriginal: false
  });

  await updateDocumentsOnChange(bds, previousSchema, currentSchema);

  bs.emitSchemaChanges();

  if (history) {
    await history.updateHistories(previousSchema, currentSchema);
  }

  return currentSchema;
}

export async function remameProperty(
  bs: BucketService,
  bds: BucketDataService,
  history: HistoryService,
  bucket: Bucket,
  oldName: string,
  newName: string
) {
  const doesFieldExist = bucket.properties[oldName];
  if(!doesFieldExist){
    throw Error(`Property '${oldName}' does not exist.`)
  }
  // update bucket schema
  let currentBucket = deepCopy(bucket);
  const propertyValue = currentBucket.properties[oldName];
  delete currentBucket.properties[oldName];
  currentBucket.properties[newName] = propertyValue;

  const _id = new ObjectId(currentBucket._id);
  delete currentBucket._id;

  currentBucket = await bs.findOneAndReplace({_id: _id}, currentBucket, {returnOriginal: false});

  // update bucket-data
  await bds.children(bucket).updateMany({}, {$rename: {[oldName]: newName}});

  // emit schema changes
  bs.emitSchemaChanges();

  // emit history
  // should be detected somehow

  // return schema
  return currentBucket;
}

export async function remove(
  bs: BucketService,
  bds: BucketDataService,
  history: HistoryService,
  id: string | ObjectId
) {
  const schema = await bs.drop(new ObjectId(id));

  if (schema) {
    const promises = [];

    promises.push(clearRelationsOnDrop(bs, bds, schema._id));
    if (history) {
      promises.push(history.deleteMany({bucket_id: schema._id}));
    }

    await Promise.all(promises);

    bs.emitSchemaChanges();
  }
}

// helpers
function ruleValidation(schema: Bucket) {
  try {
    expression.extractPropertyMap(schema.acl.read);
    expression.aggregate(schema.acl.read, {
      auth: {
        identifier: "",
        policies: []
      },
      document: {}
    });
  } catch (error) {
    throw new BadRequestException("Error occurred while parsing read rule\n" + error.message);
  }

  try {
    expression.run(schema.acl.write, {
      auth: {
        identifier: "",
        policies: []
      },
      document: {}
    });
  } catch (error) {
    throw new BadRequestException("Error occurred while parsing write rule\n" + error.message);
  }
}

async function updateDocumentsOnChange(
  bucketDataService: BucketDataService,
  previousSchema: Bucket,
  currentSchema: Bucket
) {
  const targets = schemaDiff(previousSchema, currentSchema)
    .filter(change => {
      if (change.kind == ChangeKind.Add) {
        return false;
      }

      if (change.lastPath.length) {
        for (const keyword of ["type", "relationType", "bucketId"]) {
          if (change.lastPath.includes(keyword)) {
            return true;
          }
        }
        return false;
      }

      return true;
    })
    // for array targets
    .map(change => change.path.join(".").replace(/\/\[0-9]\*\//g, "$[]"));

  const unsetFields = {};

  for (const target of targets) {
    unsetFields[target] = "";
  }

  if (!Object.keys(unsetFields).length) {
    return;
  }

  await bucketDataService.children(previousSchema).updateMany({}, {$unset: unsetFields});
}

async function clearRelationsOnDrop(
  bucketService: BucketService,
  bucketDataService: BucketDataService,
  bucketId: ObjectId
) {
  const buckets = await bucketService.find();

  const updatePromises = [];

  for (const bucket of buckets) {
    const targets = Array.from(
      findRelations(bucket.properties, bucketId.toHexString(), "", new Map()).keys()
    );

    const unsetFieldsBucket = targets.reduce((acc, current) => {
      current = "properties." + current.replace(/\./g, ".properties.");
      acc = {...acc, [current]: ""};
      return acc;
    }, {});

    if (Object.keys(unsetFieldsBucket).length) {
      updatePromises.push(bucketService.updateMany({_id: bucket._id}, {$unset: unsetFieldsBucket}));
    }

    const unsetFieldsBucketData = targets.reduce((acc, current) => {
      acc = {...acc, [current]: ""};
      return acc;
    }, {});

    if (Object.keys(unsetFieldsBucketData).length) {
      updatePromises.push(
        bucketDataService.children(bucket).updateMany({}, {$unset: unsetFieldsBucketData})
      );
    }
  }

  return Promise.all(updatePromises);
}
