import {BucketDataService, BucketService} from "@spica-server/bucket/services";
import {Bucket} from "@spica-server/interface/bucket";
import {
  DocChange,
  RepChange,
  RepresentativeManagerResource,
  VCSynchronizerArgs
} from "@spica-server/interface/versioncontrol";
import * as CRUD from "../crud";
import {HistoryService} from "@spica-server/bucket/history";
import YAML from "yaml";
import {ObjectId} from "bson";

export const getSynchronizer = (
  bs: BucketService,
  bds: BucketDataService,
  history: HistoryService
): VCSynchronizerArgs<Bucket> => {
  const fileName = "schema";
  const extension = "yaml";

  const convertToRepResource = (change: DocChange<Bucket>) => ({
    name: change.resource.title,
    content: YAML.stringify(change.resource)
  });

  const convertToDocResource = (change: RepChange<RepresentativeManagerResource>) => {
    const parsed = change.resource.content ? YAML.parse(change.resource.content) : {};
    return {...parsed, title: change.resource.name};
  };

  return {
    syncs: [
      {
        watcher: {collectionService: bs},
        converter: {convertToRepResource},
        applier: {fileName, getExtension: () => extension}
      },
      {
        watcher: {filesToWatch: [{name: fileName, extension}]},
        converter: {convertToDocResource},
        applier: {
          insert: (bucket: Bucket) => CRUD.insert(bs, bucket),
          update: (bucket: Bucket) => CRUD.replace(bs, bds, history, bucket),
          delete: (bucket: Bucket) => {
            console.log(bucket);

            CRUD.removeByName(bs, bds, history, bucket.title);
          }
        }
      }
    ],
    moduleName: "bucket",
    subModuleName: "schema"
  };
};
