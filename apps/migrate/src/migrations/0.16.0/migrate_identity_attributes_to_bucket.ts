import {Context} from "../../migrate";
import {ObjectId} from "mongodb";

export default async function (ctx: Context) {
  const identityCollection = ctx.database.collection("identity");
  const identities = await identityCollection.find({attributes: {$exists: true}}).toArray();

  if (identities.length === 0) {
    return;
  }

  const attributeKeys = new Set<string>();
  identities.forEach(identity => {
    if (identity.attributes && typeof identity.attributes === "object") {
      Object.keys(identity.attributes).forEach(key => attributeKeys.add(key));
    }
  });

  if (attributeKeys.size === 0) {
    return;
  }

  const properties = {
    auth_name: {
      type: "string",
      title: "Auth Name",
      description: "Identity identifier reference"
    }
  };

  // Add all attribute keys as properties
  attributeKeys.forEach(key => {
    properties[key] = {
      type: "string",
      title: key.charAt(0).toUpperCase() + key.slice(1),
      description: `Migrated from identity.attributes.${key}`
    };
  });

  const bucketId = new ObjectId();
  const bucketSchema = {
    _id: bucketId,
    title: "Attributes",
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
