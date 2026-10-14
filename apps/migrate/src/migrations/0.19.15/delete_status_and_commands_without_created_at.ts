import {ObjectId} from "mongodb";
import {Context} from "../../migrate";

const COLLECTIONS = ["status", "commands"];
const BATCH_SIZE = 5000;

export default async function (ctx: Context) {
  if (ctx.dryRun) {
    ctx.console.info("Skipping stale status and commands cleanup due to --dry-run flag.");
    return;
  }

  const cutoff = ObjectId.createFromTime(Math.floor(Date.now() / 1000));

  for (const name of COLLECTIONS) {
    const coll = ctx.database.collection(name);
    const stale = {_id: {$lt: cutoff}, created_at: {$exists: false}};

    let deleted = 0;
    // Deliberately outside ctx.session: millions of deletes would exceed the transaction limits,
    // and removing these expired-by-design documents is idempotent so it needs no rollback.
    while (true) {
      const ids = await coll
        .find(stale, {projection: {_id: 1}, limit: BATCH_SIZE})
        .map(doc => doc._id)
        .toArray();

      if (!ids.length) {
        break;
      }

      deleted += (await coll.deleteMany({_id: {$in: ids}})).deletedCount;
    }

    ctx.console.info(`Deleted ${deleted} documents without created_at from ${name}.`);
  }
}
