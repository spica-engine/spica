import {Context} from "../../migrate";

export default async function(ctx: Context) {
  // BUCKET MIGRATION
  const coll = ctx.database.collection("buckets");
  const buckets = await coll.find<any>().toArray();
  for (const bucket of buckets) {
    const update: any = {};
    let hasKey = false;

    for (const [name, definition] of Object.entries<any>(bucket.properties || {})) {
      if (definition.type == "location") {
        hasKey = true;
        update[`properties.${name}.locationType`] = "Point";

        // BUCKET-DATA MIGRATION
        const dataCollection = await ctx.database.collection(`bucket_${bucket._id}`);
        await dataCollection.updateMany(
          {[name]: {$exists: true}},
          {
            $set: {
              [name]: {
                type: "Point",
                // HERE
                coordinates: [`$${name}.longitude`, `$${name}.latitude`]
              }
            }
          }
        );
      }
    }

    if (hasKey) {
      await coll.updateOne({_id: bucket._id}, {$set: update});
    }
  }
}
