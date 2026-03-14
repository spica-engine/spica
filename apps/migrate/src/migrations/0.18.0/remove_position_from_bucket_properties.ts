import {Context} from "../../migrate";

function removePositionFromProperties(properties: Record<string, any>): boolean {
  let hasChange = false;

  for (const key of Object.keys(properties)) {
    const prop = properties[key];
    if (prop?.options && "position" in prop.options) {
      delete prop.options.position;
      hasChange = true;
    }

    if (prop?.properties) {
      if (removePositionFromProperties(prop.properties)) {
        hasChange = true;
      }
    }

    if (prop?.items?.properties) {
      if (removePositionFromProperties(prop.items.properties)) {
        hasChange = true;
      }
    }
  }

  return hasChange;
}

export default async function (ctx: Context) {
  const coll = ctx.database.collection("buckets");
  const buckets = await coll.find({}, {session: ctx.session}).toArray();

  const bulkOps = [];

  for (const bucket of buckets) {
    if (!bucket.properties) continue;

    if (removePositionFromProperties(bucket.properties)) {
      bulkOps.push({
        updateOne: {
          filter: {_id: bucket._id},
          update: {$set: {properties: bucket.properties}}
        }
      });
    }
  }

  if (bulkOps.length) {
    await coll.bulkWrite(bulkOps, {session: ctx.session});
  }
}
