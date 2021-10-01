import {Bucket, BucketService} from "@spica-server/bucket/services";
import {ObjectId} from "@spica-server/database";
import {register, store} from "@spica-server/machinery";

function assingTitleIfNeeded(schema, name) {
  if (!schema.title) {
    schema.title = name;
  }

  if (schema.type == "object") {
    for (const propertyName in schema.properties) {
      const prop = schema.properties[propertyName];
      assingTitleIfNeeded(prop, propertyName);
    }
  } else if (schema.type == "array") {
    assingTitleIfNeeded(schema.items, name);
  }
}

async function v1_schema_to_internal(obj): Promise<Bucket> {
  const {spec} = obj;

  const bucketStore = store({group: "bucket", resource: "schemas"});

  const raw = {...spec, properties: {...spec.properties}};

  if (!raw.icon) {
    raw.icon = "outbond";
  }

  for (const propertyName in spec.properties) {
    const property = {...spec.properties[propertyName]};

    if (!raw.primary) {
      raw.primary = propertyName;
    }

    if (!property.options) {
      property.options = {
        position: "bottom"
      };
    }

    assingTitleIfNeeded(property, propertyName);

    raw.properties[propertyName] = property;

    await convertRefToRelation(raw, propertyName, property, bucketStore, "object");
  }

  return raw;
}

async function convertRefToRelation(
  raw,
  propertyName,
  property,
  bucketStore,
  parent: "object" | "array"
) {
  if (property.type == "object") {
    for (const [key, value] of Object.entries(property.properties)) {
      await convertRefToRelation(
        parent == "object" ? raw.properties[propertyName] : raw.items,
        key,
        value,
        bucketStore,
        "object"
      );
    }
  } else if (property.type == "array") {
    await convertRefToRelation(
      parent == "object" ? raw.properties[propertyName] : raw.items,
      propertyName,
      property.items,
      bucketStore,
      "array"
    );
  } else if (property.type == "relation" && typeof property.bucket == "object") {
    const schemaName = property.bucket.resourceFieldRef.schemaName;

    const relatedBucket = await bucketStore.get(schemaName);

    if (!relatedBucket.metadata.uid) {
      throw new Error("Related bucket is not ready.");
    }

    if (parent == "object") {
      raw.properties[propertyName] = {
        ...property,
        bucketId: relatedBucket.metadata.uid
      };

      delete raw.properties[propertyName].bucket;
    } else if (parent == "array") {
      raw.items = {
        ...property,
        bucketId: relatedBucket.metadata.uid
      };

      delete raw.items.bucket;
    }
  }
}

export function registerInformers(bs: BucketService) {
  register(
    {
      group: "bucket",
      resource: "schemas",
      version: "v1"
    },
    {
      add: async (obj: any) => {
        const bucketSchemaInternal = await v1_schema_to_internal(obj);
        const bkt = await bs.insertOne(bucketSchemaInternal);
        const st = store({
          group: "bucket",
          resource: "schemas"
        });
        await st.patch(obj.metadata.name, {metadata: {uid: String(bkt._id)}, status: "Ready"});
      },
      update: async (_, newObj: any) => {
        const st = store({
          group: "bucket",
          resource: "schemas"
        });

        const existing = await st.get(newObj.metadata.name);
        if (!existing.metadata.uid) {
          throw new Error("Bucket should have been inserted before updating");
        }

        const bucketSchemaInternal = await v1_schema_to_internal(newObj);
        await bs.updateOne(
          {_id: new ObjectId(existing.metadata.uid)},
          {$set: bucketSchemaInternal},
          {upsert: true}
        );
      },
      delete: async obj => {
        await bs.deleteOne({_id: new ObjectId(obj.metadata.uid)});
      }
    }
  );
}
