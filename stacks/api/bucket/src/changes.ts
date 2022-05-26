import {schemaDiff, ChangeKind} from "@spica-server/core/differ";
import {findRelations} from "@spica-server/bucket/common";
import {Bucket, BucketDataService, BucketService} from "@spica-server/bucket/services";
import {ObjectId} from "@spica-server/database";

export async function updateDocumentsOnChange(
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

export async function clearRelationsOnDrop(
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
