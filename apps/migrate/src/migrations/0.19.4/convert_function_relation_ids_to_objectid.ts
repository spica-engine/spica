import {ObjectId} from "mongodb";
import {Context} from "../../migrate";

const RELATION_FIELDS = ["secrets", "env_vars"];

function normalize(values: unknown[]) {
  const unique = new Map<string, unknown>();

  for (const value of values) {
    const id =
      typeof value == "string" && ObjectId.isValid(value) ? new ObjectId(value) : value;
    unique.set(String(id), id);
  }

  return Array.from(unique.values());
}

export default async function (ctx: Context) {
  const coll = ctx.database.collection("function");

  const fns = await coll
    .find(
      {$or: RELATION_FIELDS.map(field => ({[field]: {$elemMatch: {$type: "string"}}}))},
      {session: ctx.session}
    )
    .toArray();

  const bulkOps = [];

  for (const fn of fns) {
    const update = {};

    for (const field of RELATION_FIELDS) {
      if (Array.isArray(fn[field])) {
        update[field] = normalize(fn[field]);
      }
    }

    if (Object.keys(update).length) {
      bulkOps.push({updateOne: {filter: {_id: fn._id}, update: {$set: update}}});
    }
  }

  if (bulkOps.length) {
    await coll.bulkWrite(bulkOps, {session: ctx.session});
  }
}
