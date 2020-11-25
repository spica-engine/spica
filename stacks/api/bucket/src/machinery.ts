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

    if (!raw.visible) {
      raw.primary = propertyName;
    }

    if (!property.options) {
      property.options = {
        position: "bottom"
      };
    }

    assingTitleIfNeeded(property, propertyName);

    raw.properties[propertyName] = property;

    if (property.type == "relation" && typeof property.bucket == "object") {
      const bucketName = property.bucket.resourceFieldRef.bucketName;

      const relatedBucket = await bucketStore.get(bucketName);

      raw.properties[propertyName] = {
        ...property,
        bucketId: relatedBucket.metadata.uid
      };

      delete raw.properties[propertyName].bucket;
    }
  }

  return raw;
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
        const bucketSchemaInternal = await v1_schema_to_internal(newObj);
        await bs.updateOne({_id: new ObjectId(newObj.metadata.uid)}, {$set: bucketSchemaInternal});
      },
      delete: async obj => {
        await bs.deleteOne({_id: new ObjectId(obj.metadata.uid)});
      }
    }
  );
}
