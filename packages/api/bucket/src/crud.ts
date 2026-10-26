import {schemaDiff} from "@spica-server/core-differ";
import {ChangeKind} from "@spica-server/interface-core";
import {findRelations} from "@spica-server/bucket-common";
import {BucketService, bucketIds} from "@spica-server/bucket-services";
import {CollectionQueryFacade, Id} from "@spica-server/interface-data";
import {HistoryRepository} from "@spica-server/interface-bucket-history";
import * as expression from "@spica-server/bucket-expression";
import {BadRequestException, NotFoundException} from "@nestjs/common";
import {Bucket, BucketDataRepository} from "@spica-server/interface-bucket";

export async function find(
  queries: CollectionQueryFacade,
  options: {
    resourceFilter: object;
    sort: {[path: string]: 1 | -1};
  }
): Promise<Bucket[]> {
  return queries.find<Bucket>("buckets", options);
}

export function findOne(bs: BucketService, id: Id): Promise<Bucket> {
  return bs.findById(id);
}

export async function insert(bs: BucketService, bucket: Bucket) {
  ruleValidation(bucket);

  if (bucket._id) {
    bucket._id = bucketIds().parse(bucket._id);
  }

  await bs.insert(bucket);

  bs.emitSchemaChanges();

  return bucket;
}

export async function replace(
  bs: BucketService,
  bucketData: BucketDataRepository,
  history: HistoryRepository,
  bucket: Bucket
) {
  ruleValidation(bucket);

  // check whether we need to delete bucket id
  const _id = bucketIds().parse(bucket._id);
  delete bucket._id;

  const previousSchema = await bs.findById(_id);
  if (!previousSchema) {
    throw new NotFoundException(`Bucket with ID ${_id} does not exist.`);
  }

  const currentSchema = await bs.replaceById(_id, bucket);

  await updateDocumentsOnChange(bucketData, previousSchema, currentSchema);

  bs.emitSchemaChanges();

  if (history) {
    await history.updateHistories(previousSchema, currentSchema);
  }

  return currentSchema;
}

export async function remove(
  bs: BucketService,
  bucketData: BucketDataRepository,
  history: HistoryRepository,
  id: string | Id
) {
  const schema = await bs.drop(bucketIds().parse(id));

  if (schema) {
    const promises = [];

    promises.push(clearRelationsOnDrop(bs, bucketData, schema._id));
    if (history) {
      promises.push(history.deleteByBucket(schema._id));
    }

    await Promise.all(promises);

    bs.emitSchemaChanges();
  }
}

// helpers
function ruleValidation(schema: Bucket) {
  try {
    expression.extractPropertyMap(schema.acl.read);
    expression.aggregate(
      schema.acl.read,
      {
        auth: {
          identifier: "",
          policies: []
        },
        document: {}
      },
      "match"
    );
  } catch (error) {
    throw new BadRequestException("Error occurred while parsing read rule\n" + error.message);
  }

  try {
    expression.run(
      schema.acl.write,
      {
        auth: {
          identifier: "",
          policies: []
        },
        document: {}
      },
      "match"
    );
  } catch (error) {
    throw new BadRequestException("Error occurred while parsing write rule\n" + error.message);
  }
}

async function updateDocumentsOnChange(
  bucketData: BucketDataRepository,
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
    .map(change => change.path);

  if (!targets.length) {
    return;
  }

  await bucketData.unsetFields(previousSchema, targets);
}

async function clearRelationsOnDrop(
  bucketService: BucketService,
  bucketData: BucketDataRepository,
  bucketId: Id
) {
  const buckets = await bucketService.findAll();

  const updatePromises = [];

  for (const bucket of buckets) {
    const targets = Array.from(
      findRelations(bucket.properties, bucketId.toString(), "", new Map()).keys()
    );

    if (targets.length) {
      updatePromises.push(
        bucketService.unsetProperties(
          bucket._id,
          targets.map(target => "properties." + target.replace(/\./g, ".properties."))
        )
      );
      updatePromises.push(
        bucketData.unsetFields(
          bucket,
          targets.map(target => target.split("."))
        )
      );
    }
  }

  return Promise.all(updatePromises);
}
