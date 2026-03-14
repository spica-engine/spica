import {Context} from "../../migrate";

export default async function (ctx: Context) {
  const coll = ctx.database.collection("strategy");

  await coll.updateMany({type: "oauth"}, {$set: {"options.idp": "custom"}});
}
