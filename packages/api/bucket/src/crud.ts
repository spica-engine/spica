import {schemaDiff} from "@spica-server/core-differ";
import {ChangeKind} from "@spica-server/interface-core";
import {findRelations} from "@spica-server/bucket-common";
import {BucketDataService, BucketService} from "@spica-server/bucket-services";
import {ObjectId, ReturnDocument} from "@spica-server/database";
import {HistoryService} from "@spica-server/bucket-history";
import * as expression from "@spica-server/bucket-expression";
import {BadRequestException, NotFoundException} from "@nestjs/common";
import {Bucket} from "@spica-server/interface-bucket";

export async function find(
  bs: BucketService,
  options: {
    resourceFilter: object;
    sort: object;
  }
): Promise<Bucket[]> {
  return bs.aggregate<Bucket>([options.resourceFilter, {$sort: options.sort}]).toArray();
}

export function findOne(bs: BucketService, id: ObjectId): Promise<Bucket> {
  return bs.findOne({_id: id});
}

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

  // check whether we need to delete bucket id
  const _id = new ObjectId(bucket._id);
  delete bucket._id;

  const previousSchema = await bs.findOne({_id});
  if (!previousSchema) {
    throw new NotFoundException(`Bucket with ID ${_id} does not exist.`);
  }

  const currentSchema = await bs.findOneAndReplace({_id}, bucket, {
    returnDocument: ReturnDocument.AFTER
  });

  await updateDocumentsOnChange(bds, previousSchema, currentSchema);

  bs.emitSchemaChanges();

  if (history) {
    await history.updateHistories(previousSchema, currentSchema);
  }

  return currentSchema;
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

  const collection = bucketDataService.children(previousSchema);

  /**
   * On a relational backend clearing the **root** fields is both needless and impossible.
   *
   * Needless: the **column** of a removed root field, or one whose type changed, is dropped
   * (`alignCollection` → `ISchemaManager.plan`, `clearOnTypeChange`), so the data goes with it.
   * Impossible: it would mean writing an `$unset` to a column that no longer exists, and the compiler
   * rightly rejects that (`'root_removed' is not a property of this bucket`) — in the measurement
   * `PUT /bucket/:id` was returning a 500 because of it.
   *
   * Paths whose root **remains** (`nested_object.child.removed`) are not filtered out: those live inside a
   * single `jsonb` column, the column is in place and the sub-path really does have to be deleted.
   *
   * No filtering is done on MongoDB: there is no schema there and a field only leaves the document through
   * an `$unset`.
   */
  const backend = (collection as unknown as {db?: {capabilities?: {backend?: string}}}).db
    ?.capabilities?.backend;
  const currentProperties = currentSchema.properties || {};
  const applicable =
    backend && backend !== "mongodb"
      ? targets.filter(target => target.split(".")[0] in currentProperties)
      : targets;

  const unsetFields = {};

  for (const target of applicable) {
    unsetFields[target] = "";
  }

  if (!Object.keys(unsetFields).length) {
    return;
  }

  await collection.updateMany({}, {$unset: unsetFields});
}

type BucketProperties = NonNullable<Bucket["properties"]>;

/**
 * A copy of `properties` without the given relation paths.
 *
 * A path is dotted in document terms (`a.b`), which in the definition means `a.properties.b`. Keys are
 * re-inserted in their original order — that order is the field order, so preserving it is the whole point.
 */
function withoutRelationFields(properties: BucketProperties, paths: string[]): BucketProperties {
  const removals = new Map<string, string[]>();

  for (const path of paths) {
    const [head, ...rest] = path.split(".");
    if (!removals.has(head)) removals.set(head, []);
    if (rest.length) removals.get(head)!.push(rest.join("."));
  }

  const result: BucketProperties = {};

  for (const [key, property] of Object.entries(properties)) {
    const nested = removals.get(key);

    // No entry: untouched. An entry with no remainder: this field itself is the relation being removed.
    if (!nested) {
      result[key] = property;
      continue;
    }
    if (!nested.length) continue;

    result[key] = {
      ...property,
      properties: withoutRelationFields((property.properties as BucketProperties) ?? {}, nested)
    };
  }

  return result;
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

    /**
     * The definition is rewritten **in JS** and written back whole, rather than `$unset`ing the sub-paths.
     *
     * A bucket's `properties` is an ordered object: its key order is the field order the panel shows. Writing
     * a sub-path means `jsonb_set`, and `jsonb` normalizes keys by length then bytes — so removing one
     * relation field silently reshuffled all the others. Rebuilding the object keeps the order the
     * author chose, on both backends: the remaining keys are re-inserted in their original sequence.
     */
    if (targets.length) {
      updatePromises.push(
        bucketService.updateMany(
          {_id: bucket._id},
          {$set: {properties: withoutRelationFields(bucket.properties, targets)}}
        )
      );
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
