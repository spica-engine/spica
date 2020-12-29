import {Context} from "../../../src/migrate";

export default async function(ctx: Context) {
  const coll = ctx.database.collection("function");
  const functions = await coll.find<any>().toArray();
  for (const fn of functions) {
    const update: any = {};
    let hasKey = false;

    for (const [handler, trigger] of Object.entries<any>(fn.triggers)) {
      if (trigger.type == "bucket") {
        hasKey = true;
        update[`triggers.${handler}.options.phase`] = "";
      }
    }

    if (hasKey) {
      await coll.updateOne({_id: fn._id}, {$unset: update});
    }
  }
}
