import {Context} from "../../migrate";

export default async function (ctx: Context) {
  await ctx.database
    .collection("strategy")
    .updateMany(
      {type: "oauth", "options.idp": "google", "options.code.params.scope": "email"},
      {$set: {"options.code.params.scope": "email profile"}},
      {session: ctx.session}
    );
}
