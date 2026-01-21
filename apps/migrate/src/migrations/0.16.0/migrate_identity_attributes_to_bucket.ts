import {Context} from "../../migrate";
import {ObjectId} from "mongodb";

export default async function (ctx: Context) {
  const identityCollection = ctx.database.collection("identity");
  const identities = await identityCollection.find({attributes: {$exists: true}}).toArray();

  if (identities.length === 0) {
    return;
  }

  const preferenceCollection = ctx.database.collection("preferences");
  const passportPreference = await preferenceCollection.findOne(
    {scope: "passport"},
    {session: ctx.session}
  );

  const attributeSchema = passportPreference?.identity?.schema?.attributes || {};

  // Find a unique bucket title
  const bucketsCollection = ctx.database.collection("buckets");
  let bucketTitle = "Attributes";
  let counter = 1;

  while (await bucketsCollection.findOne({title: bucketTitle}, {session: ctx.session})) {
    bucketTitle = `Attributes_${counter}`;
    counter++;
  }

  const properties: any = {
    auth_name: {
      type: "string",
      title: "Auth Name",
      description: "Identity identifier reference"
    }
  };

  Object.assign(properties, attributeSchema);

  const bucketId = new ObjectId();
  const bucketSchema = {
    _id: bucketId,
    title: bucketTitle,
    description: "Migrated identity attributes",
    icon: "view_stream",
    primary: "auth_name",
    readOnly: false,
    history: false,
    properties,
    acl: {
      write: "true==true",
      read: "true==true"
    }
  };

  await ctx.database.collection("buckets").insertOne(bucketSchema, {session: ctx.session});

  const bucketDataCollection = ctx.database.collection(`bucket_${bucketId}`);

  const bulkOps = [];
  for (const identity of identities) {
    if (identity.attributes && typeof identity.attributes === "object") {
      const attributeDoc = {
        auth_name: identity.identifier
      };

      Object.entries(identity.attributes).forEach(([key, value]) => {
        attributeDoc[key] = value;
      });

      bulkOps.push({
        insertOne: {
          document: attributeDoc
        }
      });
    }
  }

  if (bulkOps.length > 0) {
    await bucketDataCollection.bulkWrite(bulkOps, {session: ctx.session});
  }

  await identityCollection.updateMany(
    {attributes: {$exists: true}},
    {$unset: {attributes: ""}},
    {session: ctx.session}
  );
}
