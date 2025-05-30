import {BucketDataService, BucketService} from "@spica-server/bucket/services";
import {Bucket} from "@spica-server/interface/bucket";
import {
  IRepresentativeManager,
  RepresentativeManagerResource
} from "@spica-server/interface/representative";
import {
  ChangeTypes,
  DocChange,
  RepChange,
  ResourceType,
  SynchronizerArgs,
  VCSynchronizerArgs
} from "@spica-server/interface/versioncontrol";
import {ChangeStreamDocument, ObjectId} from "mongodb";
import {Observable} from "rxjs";
import YAML from "yaml";
import * as CRUD from "../crud";
import {HistoryService} from "@spica-server/bucket/history";

export const getSynchronizer = (
  bs: BucketService,
  bds: BucketDataService,
  history: HistoryService,
  vcRepresentativeManager: IRepresentativeManager
): VCSynchronizerArgs<Bucket, RepresentativeManagerResource> => {
  const moduleName = "bucket";
  const fileName = "schema";
  const extension = "yaml";

  const docWatcher = () => {
    return new Observable<DocChange<Bucket>>(observer => {
      const changeStream = bs._coll.watch([], {
        fullDocument: "updateLookup"
      });

      changeStream.on("change", (change: ChangeStreamDocument<Bucket>) => {
        let changeType: ChangeTypes;
        let resource: Bucket;

        switch (change.operationType) {
          case "insert":
            changeType = ChangeTypes.INSERT;
            resource = change.fullDocument!;
            break;

          case "replace":
          case "update":
            changeType = ChangeTypes.UPDATE;
            resource = change.fullDocument!;
            break;

          case "delete":
            changeType = ChangeTypes.DELETE;
            resource = {_id: change.documentKey._id} as Bucket;
            break;

          default:
            return;
        }

        const docChange: DocChange<Bucket> = {
          resourceType: ResourceType.DOCUMENT,
          changeType,
          resource
        };

        observer.next(docChange);
      });

      changeStream.on("error", err => observer.error(err));
      changeStream.on("close", () => observer.complete());

      bs._coll
        .find()
        .toArray()
        .then(buckets => {
          buckets.forEach(bucket => {
            const docChange: DocChange<Bucket> = {
              resourceType: ResourceType.DOCUMENT,
              changeType: ChangeTypes.INSERT,
              resource: bucket
            };

            observer.next(docChange);
          });
        });

      return () => changeStream.close();
    });
  };

  const docToRepConverter = (
    change: DocChange<Bucket>
  ): RepChange<RepresentativeManagerResource> => {
    return {
      ...change,
      resourceType: ResourceType.REPRESENTATIVE,
      resource: {
        _id: change.resource._id.toString(),
        content: YAML.stringify(change.resource)
      }
    };
  };

  const repApplier = (change: RepChange<RepresentativeManagerResource>) => {
    const write = (resource: RepresentativeManagerResource) => {
      vcRepresentativeManager.write(
        moduleName,
        resource._id,
        fileName,
        resource.content,
        extension
      );
    };

    const rm = (resource: RepresentativeManagerResource) => {
      vcRepresentativeManager.rm(moduleName, resource._id);
    };

    const representativeStrategy = {
      [ChangeTypes.INSERT]: write,
      [ChangeTypes.UPDATE]: write,
      [ChangeTypes.DELETE]: rm
    };

    representativeStrategy[change.changeType](change.resource);
  };

  return {
    syncs: [
      {
        watcher: {
          service: bs
        }
        // converter: {
        //   convert: docToRepConverter
        // },
        // applier: {
        //   resourceType: ResourceType.REPRESENTATIVE,
        //   apply: repApplier
        // }
      },
      {
        watcher: {
          filesToWatch: [{name: fileName, extension}]
        },
        converter: {
          resourceType: "document"
        },
        applier: {
          insert: (bucket: Bucket) => CRUD.insert(bs, bucket),
          update: (bucket: Bucket) => CRUD.replace(bs, bds, history, bucket),
          delete: (bucket: Bucket) => CRUD.remove(bs, bds, history, bucket._id)
        }
      }
    ],
    moduleName,
    subModuleName: "schema"
  };
};
