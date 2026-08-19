import {Context} from "../../migrate";

export default async function (ctx: Context) {
  await ctx.database
    .collection("function")
    .updateMany(
      {memoryLimit: {$exists: true}},
      {$unset: {memoryLimit: ""}},
      {session: ctx.session}
    );
}
