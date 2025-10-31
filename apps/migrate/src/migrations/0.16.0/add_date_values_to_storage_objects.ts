import {Context} from "../../migrate";

export default async function (ctx: Context) {
  const storageCollection = ctx.database.collection("storage");

  const objectsWithoutTimestamps = await storageCollection.find({}).toArray();

  if (!objectsWithoutTimestamps.length) return;

  const bulkOps = [];

  for (const obj of objectsWithoutTimestamps) {
    const timestamp = new Date(obj._id.getTimestamp());

    bulkOps.push({
      updateOne: {
        filter: {_id: obj._id},
        update: {
          $set: {
            created_at: timestamp,
            updated_at: timestamp
          }
        }
      }
    });
  }

  if (bulkOps.length) {
    await storageCollection.bulkWrite(bulkOps, {ordered: false});
  }
}
