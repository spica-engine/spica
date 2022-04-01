import {BucketService} from "@spica-server/bucket/services";
import {ObjectId} from "@spica-server/database";
import {
  DocumentProvider,
  IRepresentativeManager,
  RepresentativeProvider,
  SyncProvider
} from "@spica-server/versioncontrol";

export const getSyncProvider = (
  service: BucketService,
  manager: IRepresentativeManager
): SyncProvider => {
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

  const document: DocumentProvider = {
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

  const representative: RepresentativeProvider = {
    module,

    insert: doc => {
      doc = loseObjectId(doc);
      return manager.write(module, doc._id, "schema", doc, "yaml");
    },

    update: doc => {
      doc = loseObjectId(doc);
      return manager.write(module, doc._id, "schema", doc, "yaml");
    },

    delete: doc => manager.delete(module, doc._id),
    getAll: () =>
      manager
        .read(module, resourceNameValidator, [])
        .then(resources => resources.map(resource => resource.contents.schema))
  };

  return {
    document,
    representative
  };
};
