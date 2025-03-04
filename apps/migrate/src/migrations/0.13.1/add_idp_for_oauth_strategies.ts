import {Context} from "../../migrate";

export default async function (ctx: Context) {
  const coll = ctx.database.collection("strategy");
  const strategies = await coll.find({type: "oauth"}).toArray();

  const bulkOps = [];

  for (let strategy of strategies) {
    bulkOps.push({
      updateOne: {filter: {_id: strategy._id}, update: {$set: {"options.idp": "custom"}}}
    });
  }

  if (bulkOps.length) {
    await coll.bulkWrite(bulkOps);
  }
}
