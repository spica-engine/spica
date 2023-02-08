import {schemaDiff, ChangeKind} from "@spica-server/core/differ";
import {findRelations} from "@spica-server/bucket/common";
import {Bucket, BucketDataService, BucketService} from "@spica-server/bucket/services";
import {ObjectId} from "@spica-server/database";
import {HistoryService} from "@spica-server/bucket/history";
import * as expression from "@spica-server/bucket/expression";
import {BadRequestException} from "@nestjs/common";
import {Command} from "@spica-server/interface/asset";
import {Commander} from "@spica-server/asset";

// export async function insert(bs: BucketService, bucket: Bucket) {
//   ruleValidation(bucket);

//   if (bucket._id) {
//     bucket._id = new ObjectId(bucket._id);
//   }

//   await bs.insertOne(bucket);

//   bs.emitSchemaChanges();

//   return bucket;
// }

// export class BucketCommander extends Commander {
//   constructor(commands: Command[]) {
//     super(commands);
//   }
// }

export function runCommands(commands: Command[]) {
  return Promise.all(commands.map(command => command.execute()));
}

export async function insert(bs: BucketService, bucket: Bucket) {
  bucket._id = new ObjectId(bucket._id);

  // for only the insert action, we can't undo insert action since there might be existing bucket with the same id
  // we should ensure that bucket insert has been failed or succeeded.
  let hasBucketInserted = () => false;
  const insertCommand: Command = {
    title: `Bucket ${bucket._id} Insert`,
    execute: async () => {
      await bs.insertOne(bucket);
      hasBucketInserted = () => true;
      bs.emitSchemaChanges();
    },
    undo: async () => {
      if (hasBucketInserted()) {
        await bs.findOneAndDelete({_id: bucket._id});
        bs.emitSchemaChanges();
      }
      hasBucketInserted = () => false;
    }
  };

  return Promise.resolve([insertCommand]);
}

export async function replace(
  bs: BucketService,
  bds: BucketDataService,
  history: HistoryService,
  bucket: Bucket
) {
  const _id = new ObjectId(bucket._id);
  delete bucket._id;

  const previousSchema = await bs.findOne({_id});
  const currentSchema = bucket;

  const updateBucketCmd: Command = {
    title: `Bucket ${bucket._id} Update`,
    execute: async () => {
      await bs.findOneAndReplace({_id}, bucket);
      bs.emitSchemaChanges();
    },
    undo: async () => {
      await bs.findOneAndReplace({_id}, previousSchema);
      bs.emitSchemaChanges();
    }
  };

  const commands = [updateBucketCmd];

  const targets = findEffectedTargetsOnUpdate(previousSchema, currentSchema);

  if (!targets.length) {
    return commands;
  }

  const dataWillBeUpdated = await findDataIncludeOneOfTargets(previousSchema, bds, targets);

  if (!dataWillBeUpdated.length) {
    return commands;
  }

  const updateDataCmd: Command = {
    title: `Bucket-Data Update of Bucket ${bucket._id} Update`,
    execute: () => {
      const unsetFields = getBucketDataUnsetForTargets(targets);
      return bds.children(currentSchema).updateMany({}, {$unset: unsetFields});
    },
    undo: () => {
      const promises = dataWillBeUpdated.map(data => {
        const _id = data._id;
        delete data._id;
        return bds.children(currentSchema).findOneAndReplace({_id}, data);
      });

      return Promise.all(promises);
    }
  };

  commands.push(updateDataCmd);

  if (!history) {
    return commands;
  }

  const oldHistories = [];

  await Promise.all(
    dataWillBeUpdated.map(data =>
      history.find({dataument_id: data._id}).then(histories => oldHistories.push(...histories))
    )
  );

  if (!oldHistories.length) {
    return commands;
  }

  const updateHistoriesCmd: Command = {
    title: `Bucket-Data History Update of Bucket ${bucket._id} Update`,
    execute: () => history.updateHistories(previousSchema, currentSchema),
    undo: () =>
      Promise.all(
        oldHistories.map(oldHistory =>
          history.collection.findOneAndReplace({_id: oldHistory._id}, oldHistory, {
            upsert: true
          })
        )
      )
  };
  commands.push(updateHistoriesCmd);

  return commands;
}

export async function remove(
  bs: BucketService,
  bds: BucketDataService,
  history: HistoryService,
  id: string | ObjectId
) {
  const schema = await bs.findOne({_id: new ObjectId(id)});

  const dropCollCmd: Command = {
    title: `Bucket ${id.toString()} Delete`,
    execute: async () => {
      await bs.drop(schema._id);
      bs.emitSchemaChanges();
    },
    undo: async () => {
      await bs.insertOne(schema);
      bs.emitSchemaChanges();
    }
  };

  const commands = [dropCollCmd];

  const targetsByBuckets = await findEffectedTargetsOnDrop(bs, new ObjectId(id));

  if (!targetsByBuckets.length) {
    return commands;
  }

  const bucketsBeforeUpdate = await Promise.all(
    targetsByBuckets.map(targetByBucket => bs.findOne({_id: targetByBucket.bucket._id}))
  );

  const updateBucketsCmd: Command = {
    title: `Related Bucket Update of Bucket ${id.toString()} Delete`,
    execute: () => {
      const promises = [];
      for (let {bucket, targets} of targetsByBuckets) {
        const unsetFields = getBucketUnsetForTargets(targets);
        promises.push(bs.findOneAndUpdate({_id: bucket._id}, {$unset: unsetFields}));
      }

      return Promise.all(promises);
    },
    undo: () =>
      Promise.all(
        bucketsBeforeUpdate.map(bucket => bs.findOneAndReplace({_id: bucket._id}, bucket))
      )
  };
  commands.push(updateBucketsCmd);

  const dataWillBeUpdatedByBucket: {bucket: Bucket; data: any[]}[] = [];

  await Promise.all(
    targetsByBuckets.map(({bucket, targets}) =>
      findDataIncludeOneOfTargets(bucket, bds, targets).then(data => {
        if (data.length) {
          dataWillBeUpdatedByBucket.push({bucket, data});
        }
      })
    )
  );

  if (!dataWillBeUpdatedByBucket.length) {
    return commands;
  }

  const updateBucketDataCmd: Command = {
    title: `Related Bucket-Data Update of Bucket ${id.toString()} Delete`,
    execute: () => {
      const promises = [];
      for (let {bucket, targets} of targetsByBuckets) {
        const unsetFields = getBucketDataUnsetForTargets(targets);
        promises.push(bds.children(bucket).updateMany({}, {$unset: unsetFields}));
      }
      return Promise.all(promises);
    },
    undo: () => {
      const promises = [];
      for (let {bucket, data} of dataWillBeUpdatedByBucket) {
        promises.push(...data.map(d => bds.children(bucket).findOneAndReplace({_id: d._id}, d)));
      }
      return Promise.all(promises);
    }
  };
  commands.push(updateBucketDataCmd);

  if (!history) {
    return commands;
  }

  const oldHistories = await history.find({bucket_id: schema._id});

  if (oldHistories.length) {
    return commands;
  }

  const deleteHistoriesCmd: Command = {
    title: `Bucket-Data History Delete of Bucket ${id.toString()} Delete`,
    execute: () => history.deleteMany({bucket_id: schema._id}),
    undo: () => history.collection.insertMany(oldHistories)
  };
  commands.push(deleteHistoriesCmd);

  return commands;
}

// export async function replace(
//   bs: BucketService,
//   bds: BucketDataService,
//   history: HistoryService,
//   bucket: Bucket
// ) {
//   ruleValidation(bucket);

//   // check whether we need to delete bucket id
//   const _id = new ObjectId(bucket._id);
//   delete bucket._id;

//   const previousSchema = await bs.findOne({_id});

//   const currentSchema = await bs.findOneAndReplace({_id}, bucket, {
//     returnOriginal: false
//   });

//   await updatedataumentsOnChange(bds, previousSchema, currentSchema);

//   bs.emitSchemaChanges();

//   if (history) {
//     await history.updateHistories(previousSchema, currentSchema);
//   }

//   return currentSchema;
// }

// export async function remove(
//   bs: BucketService,
//   bds: BucketDataService,
//   history: HistoryService,
//   id: string | ObjectId
// ) {
//   const schema = await bs.drop(new ObjectId(id));

//   if (schema) {
//     const promises = [];

//     promises.push(clearRelationsOnDrop(bs, bds, schema._id));
//     if (history) {
//       promises.push(history.deleteMany({bucket_id: schema._id}));
//     }

//     await Promise.all(promises);

//     bs.emitSchemaChanges();
//   }
// }

// helpers
function ruleValidation(schema: Bucket) {
  try {
    expression.extractPropertyMap(schema.acl.read);
    expression.aggregate(schema.acl.read, {
      auth: {
        identifier: "",
        policies: []
      },
      dataument: {}
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
      dataument: {}
    });
  } catch (error) {
    throw new BadRequestException("Error occurred while parsing write rule\n" + error.message);
  }
}

function findEffectedTargetsOnUpdate(previousSchema: Bucket, currentSchema: Bucket) {
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

  return targets;
}

function findDataIncludeOneOfTargets(
  schema: Bucket,
  bucketDataService: BucketDataService,
  targets: string[]
) {
  if (!targets.length) {
    return Promise.resolve([]);
  }

  const query = {
    $or: targets.map(target => {
      return {[target]: {$exist: true}};
    })
  };

  return bucketDataService.children(schema).find(query);
}

function getBucketDataUnsetForTargets(targets: string[]) {
  return targets.reduce((acc, current) => {
    acc = {...acc, [current]: ""};
    return acc;
  }, {});
}

function getBucketUnsetForTargets(targets: string[]) {
  return targets.reduce((acc, current) => {
    current = "properties." + current.replace(/\./g, ".properties.");
    acc = {...acc, [current]: ""};
    return acc;
  }, {});
}

async function updatedataumentsOnChange(
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

async function findEffectedTargetsOnDrop(
  bs: BucketService,
  droppedBucketId: ObjectId
): Promise<{bucket: Bucket; targets: string[]}[]> {
  const buckets = await bs.find();

  const targetsByBuckets = [];

  for (const bucket of buckets) {
    const targets = Array.from(
      findRelations(bucket.properties, droppedBucketId.toHexString(), "", new Map()).keys()
    );

    if (targets.length) {
      targetsByBuckets.push({bucket, targets});
    }
  }

  return targetsByBuckets;
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
