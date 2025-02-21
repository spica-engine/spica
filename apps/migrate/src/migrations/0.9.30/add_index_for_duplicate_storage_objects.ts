import {Context} from "../../migrate";

export default async function (ctx: Context) {
  const coll = ctx.database.collection("storage");
  const storageObjects = await coll
    .aggregate([
      {
        $group: {
          _id: "$name",
          count: {$sum: 1},
          docs: {$push: "$$ROOT"}
        }
      },
      {
        $match: {count: {$gt: 1}}
      },
      {
        $unwind: "$docs"
      },
      {
        $replaceRoot: {newRoot: "$docs"}
      }
    ])
    .toArray();

  const nameCounts = {};
  const bulkOps = [];

  for (let obj of storageObjects) {
    const originalName: string = obj.name;

    if (!nameCounts[originalName]) {
      nameCounts[originalName] = 1;
    } else {
      const newName = createNewName(originalName, ++nameCounts[originalName]);

      bulkOps.push({updateOne: {filter: {_id: obj._id}, update: {$set: {name: newName}}}});
    }
  }

  if (bulkOps.length) {
    await coll.bulkWrite(bulkOps);
  }
}

function createNewName(originalName: string, index: number) {
  const nameParts = originalName.split(".");

  if (nameParts.length > 1) {
    const extension = nameParts.pop();
    return `${nameParts.join(".")}(${index}).${extension}`;
  } else {
    return `${originalName}(${index})`;
  }
}
