import {Context} from "../../migrate";

export default async function (ctx: Context) {
  // BUCKET MIGRATION
  const coll = ctx.database.collection("buckets");
  const buckets = await coll.find().toArray();
  for (const bucket of buckets) {
    const update: any = {};
    let hasKey = false;

    for (const [name, definition] of Object.entries<any>(bucket.properties || {})) {
      if (definition.type == "location") {
        hasKey = true;
        update[`properties.${name}.locationType`] = "Point";

        // BUCKET-DATA MIGRATION
        const dataCollection = ctx.database.collection(`bucket_${bucket._id}`);
        const documents = await dataCollection.find({[name]: {$exists: true}}).toArray();
        for (const document of documents) {
          const newLocation = {
            type: "Point",
            coordinates: [document[name].longitude, document[name].latitude]
          };
          await dataCollection.findOneAndUpdate(
            {_id: document._id},
            {
              $set: {
                [name]: newLocation
              }
            }
          );
        }
      }
    }

    if (hasKey) {
      await coll.updateOne({_id: bucket._id}, {$set: update});
    }
  }
}
