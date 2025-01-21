import {Context} from "@spica/migrate";

export default function(ctx: Context) {
  const coll = ctx.database.collection("_test_");
  return coll.insertOne({});
}
