import {BucketDataService, BucketService} from "@spica-server/bucket/services";
import {Bucket} from "@spica-server/interface/bucket";
import {VCSynchronizerArgs} from "@spica-server/interface/versioncontrol";
import * as CRUD from "../crud";
import {HistoryService} from "@spica-server/bucket/history";

export const getSynchronizer = (
  bs: BucketService,
  bds: BucketDataService,
  history: HistoryService
): VCSynchronizerArgs<Bucket> => ({
  syncs: [
    {
      watcher: {collectionService: bs}
    },
    {
      converter: {resourceType: "document"},
      applier: {
        insert: (bucket: Bucket) => CRUD.insert(bs, bucket),
        update: (bucket: Bucket) => CRUD.replace(bs, bds, history, bucket),
        delete: (bucket: Bucket) => CRUD.remove(bs, bds, history, bucket._id)
      }
    }
  ],
  moduleName: "bucket",
  subModuleName: "schema"
});
