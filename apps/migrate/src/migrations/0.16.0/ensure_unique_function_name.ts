import {Context} from "../../migrate";
import {ObjectId} from "mongodb";

export default async function (ctx: Context) {
  const functionCollection = ctx.database.collection("function");

  const duplicates = await functionCollection
    .aggregate([
      {$group: {_id: "$name", count: {$sum: 1}, ids: {$push: "$_id"}}},
      {$match: {count: {$gt: 1}}}
    ])
    .toArray();

  if (!duplicates.length) return;

  const existingNames = new Set(duplicates.map(d => d._id));

  const bulkOps: any[] = [];

  for (const dupe of duplicates) {
    const originalName: string = dupe._id;

    const ids: ObjectId[] = dupe.ids;
    ids.sort((a, b) => a.toHexString().localeCompare(b.toHexString()));
    const [, ...others] = ids; // Skip first (keep original)

    let suffixCounter = 1;
    for (const oid of others) {
      let newName: string;
      do {
        newName = `${originalName}(${suffixCounter++})`;
      } while (existingNames.has(newName));

      existingNames.add(newName);

      bulkOps.push({
        updateOne: {
          filter: {_id: oid},
          update: {$set: {name: newName}}
        }
      });
    }
  }

  if (bulkOps.length) {
    await functionCollection.bulkWrite(bulkOps, {ordered: false});
  }

  try {
    await functionCollection.createIndex({name: 1}, {unique: true});
  } catch (e) {
    throw e;
  }
}
