import {Context} from "../../../src/migrate";

export default async function (ctx: Context) {
  const coll = ctx.database.collection("buckets");
  return coll.updateMany({}, {$set: {acl: {write: "true==true", read: "true==true"}}});
}
