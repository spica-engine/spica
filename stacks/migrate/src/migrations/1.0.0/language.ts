import {Context} from "../../migrate";

export default async function(ctx: Context) {
  const bucketColl = ctx.database.collection("bucket");
  await bucketColl.insertOne({fromMigration: true});
}
