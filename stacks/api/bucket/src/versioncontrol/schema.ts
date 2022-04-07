import {HistoryService} from "@spica-server/bucket/history";
import {BucketDataService, BucketService} from "@spica-server/bucket/services";
import {ObjectId} from "@spica-server/database";
import {IRepresentativeManager, SyncProvider} from "@spica-server/versioncontrol";
import {clearRelationsOnDrop, updateDocumentsOnChange} from "../changes";

export const getSyncProvider = (
  bs: BucketService,
  bds: BucketDataService,
  history: HistoryService,
  manager: IRepresentativeManager
): SyncProvider => {
  const name = "bucket-schema";
  const module = "bucket";

  const getAll = () => {
    return bs.find().then(buckets =>
      buckets.map(bucket => {
        return {...bucket, _id: bucket._id.toString()};
      })
    );
  };

  const insert = async bucket => {
    await bs.insertOne({...bucket, _id: new ObjectId(bucket._id)});
    bs.emitSchemaChanges();
    return bucket;
  };

  const update = async bucket => {
    const _id = new ObjectId(bucket._id);
    delete bucket._id;

    const previousSchema = await bs.findOne({_id});

    const currentSchema = await bs.findOneAndReplace({_id}, bucket, {
      returnOriginal: false
    });

    await updateDocumentsOnChange(bds, previousSchema, currentSchema);

    bs.emitSchemaChanges();

    if (history) {
      await history.updateHistories(previousSchema, currentSchema);
    }

    return currentSchema;
  };

  const remove = async bucket => {
    const schema = await bs.drop(bucket._id);

    if (schema) {
      const promises = [];

      promises.push(clearRelationsOnDrop(bs, bds, schema._id));
      if (history) {
        promises.push(history.deleteMany({bucket_id: schema._id}));
      }

      await Promise.all(promises);

      bs.emitSchemaChanges();
    }
  };

  const document = {
    getAll,
    insert,
    update,
    delete: remove
  };

  const write = bucket => {
    bucket._id = bucket._id.toString();
    return manager.write(module, bucket._id, "schema", bucket, "yaml");
  };

  const rm = bucket => {
    return manager.rm(module, bucket._id);
  };

  const readAll = async () => {
    const resourceNameValidator = id => ObjectId.isValid(id);
    const files = await manager.read(module, resourceNameValidator, ["schema.yaml"]);
    return files.map(file => file.contents.schema);
  };

  const representative = {
    getAll: readAll,
    insert: write,
    update: write,
    delete: rm
  };

  return {
    name,
    document,
    representative,
    parents: 0
  };
};
