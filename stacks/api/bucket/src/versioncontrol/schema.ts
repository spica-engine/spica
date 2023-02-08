import {HistoryService} from "@spica-server/bucket/history";
import {BucketDataService, BucketService} from "@spica-server/bucket/services";
import {ObjectId} from "@spica-server/database";
import {IRepresentativeManager} from "@spica-server/interface/representative";
import {SyncProvider} from "@spica-server/versioncontrol";
import * as CRUD from "../crud";

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

  const insert = bucket =>
    CRUD.insert(bs, bucket)
      .then(CRUD.runCommands)
      .then(() => bucket);

  const update = bucket =>
    CRUD.replace(bs, bds, history, bucket)
      .then(CRUD.runCommands)
      .then(() => bucket);

  const remove = bucket =>
    CRUD.remove(bs, bds, history, bucket._id)
      .then(CRUD.runCommands)
      .then(() => bucket);

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
