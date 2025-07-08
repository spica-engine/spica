import {Context} from "../../migrate";

export default async function (ctx: Context) {
  const bucketCollection = ctx.database.collection("bucket");

  const buckets = await bucketCollection.find({}).toArray();

  const bulkOps = [];

  for (const bucket of buckets) {
    const indexes: any[] = [];

    if (bucket.properties && typeof bucket.properties === "object") {
      for (const [field, schema] of Object.entries<any>(bucket.properties)) {
        const options = schema.options ?? {};

        const isIndex = options.index === true;
        const isUnique = options.unique === true;

        if (isIndex || isUnique) {
          const indexObj: any = {
            definition: {[field]: 1},
            options: isUnique ? {unique: true} : {}
          };

          indexes.push(indexObj);

          delete options.index;
          delete options.unique;

          schema.options = options;
        }
      }
    }

    const updateOp: any = {
      updateOne: {
        filter: {_id: bucket._id},
        update: {
          $set: {
            properties: bucket.properties,
            indexes
          }
        }
      }
    };
    bulkOps.push(updateOp);
  }

  if (bulkOps.length) {
    await bucketCollection.bulkWrite(bulkOps);
  }
}
