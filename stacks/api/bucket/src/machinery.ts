import {Bucket, BucketService} from "@spica-server/bucket/services";
import {ObjectId} from "@spica-server/database";
import {
  DocumentProvider,
  register,
  RepresentativeManager,
  RepresentativeProvider,
  store
} from "@spica-server/machinery";

export const returnSyncProviders = (
  service: BucketService,
  representative: RepresentativeManager
) => {
  const module = "bucket";
  const resourceNameValidator = str => ObjectId.isValid(str);

  const gainObjectId = doc => {
    if (doc._id && typeof doc._id == "string") {
      doc._id = new ObjectId(doc._id);
    }
    return doc;
  };
  const loseObjectId = doc => {
    if (doc._id && typeof doc._id != "string") {
      doc._id = doc._id.toString();
    }
    return doc;
  };

  const docProvider: DocumentProvider = {
    module,
    insert: doc => service.insertOne(gainObjectId(doc)),

    update: doc => {
      doc = gainObjectId(doc);
      const copy = JSON.parse(JSON.stringify(doc));
      delete copy._id;
      return service.findOneAndReplace({_id: doc._id}, copy);
    },

    delete: id => service.findOneAndDelete({_id: new ObjectId(id)}).then(() => {}),

    getAll: () => service.find().then(docs => docs.map(doc => loseObjectId(doc)))
  };

  const repProvider: RepresentativeProvider = {
    module,

    insert: doc => {
      doc = loseObjectId(doc);
      return representative.write(module, doc._id, "schema", doc, "yaml");
    },

    update: doc => {
      doc = loseObjectId(doc);
      return representative.write(module, doc._id, "schema", doc, "yaml");
    },

    delete: doc => representative.delete(module, doc._id),
    getAll: () =>
      representative
        .readAll(module, resourceNameValidator)
        .then(resources => resources.map(resource => resource.contents.schema))
  };

  return {
    doc: docProvider,
    rep: repProvider
  };
};

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

async function v1_schema_to_internal(obj, nonExistRelations): Promise<Bucket> {
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

    await convertRefToRelation(
      raw,
      propertyName,
      property,
      bucketStore,
      "object",
      nonExistRelations
    );
  }

  return raw;
}

async function convertRefToRelation(
  raw,
  propertyName,
  property,
  bucketStore,
  parent: "object" | "array",
  nonExistRelations
) {
  if (property.type == "object") {
    for (const [key, value] of Object.entries(property.properties)) {
      await convertRefToRelation(
        parent == "object" ? raw.properties[propertyName] : raw.items,
        key,
        value,
        bucketStore,
        "object",
        nonExistRelations
      );
    }
  } else if (property.type == "array") {
    await convertRefToRelation(
      parent == "object" ? raw.properties[propertyName] : raw.items,
      propertyName,
      property.items,
      bucketStore,
      "array",
      nonExistRelations
    );
  } else if (property.type == "relation" && typeof property.bucket == "object") {
    const schemaName = property.bucket.resourceFieldRef.schemaName;

    const relatedBucketId = await bucketStore.get(schemaName).then(bucket => {
      if (!bucket || !bucket.metadata.uid) {
        nonExistRelations.push(schemaName);
        return schemaName;
      }
      return bucket.metadata.uid;
    });

    if (parent == "object") {
      raw.properties[propertyName] = {
        ...property,
        bucketId: relatedBucketId
      };

      delete raw.properties[propertyName].bucket;
    } else if (parent == "array") {
      raw.items = {
        ...property,
        bucketId: relatedBucketId
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
        const bucketName = obj.metadata.name;
        const nonExistRelations = [];
        const bucketSchemaInternal = await v1_schema_to_internal(obj, nonExistRelations);

        const st = store({
          group: "bucket",
          resource: "schemas"
        });

        const existing = await st.get(bucketName);

        let bkt;
        if (existing.metadata.uid) {
          bkt = await bs.findOneAndReplace(
            {_id: new ObjectId(existing.metadata.uid)},
            bucketSchemaInternal,
            {returnOriginal: false}
          );
        } else {
          bkt = await bs.insertOne(bucketSchemaInternal);
        }

        await st.patch(bucketName, {metadata: {uid: String(bkt._id)}, status: "Ready"});

        if (nonExistRelations.length) {
          throw Error(
            `${bucketName} has been inserted with non-exist relations '${Array.from(
              new Set(nonExistRelations)
            ).join(", ")}'. They will be replaced in the next retries.`
          );
        }
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

        const bucketSchemaInternal = await v1_schema_to_internal(newObj, []);

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
