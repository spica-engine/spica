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
  SyncProvider
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
): SynchronizerArgs<Bucket, RepresentativeManagerResource> => {
  const moduleName = "bucket";

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

  const docToRepConverter = (change: DocChange<Bucket>): RepChange<RepresentativeManagerResource> => {
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
      vcRepresentativeManager.write(moduleName, resource._id, "schema", resource.content, "yaml");
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

  const repWatcher = () => vcRepresentativeManager.watch(moduleName);

  const repToDocConverter = (change: RepChange<RepresentativeManagerResource>): DocChange<Bucket> => {
    const parsed = change.resource.content ? YAML.parse(change.resource.content) : {};

    return {
      ...change,
      resourceType: ResourceType.DOCUMENT,
      resource: {...parsed, _id: new ObjectId(change.resource._id)}
    };
  };

  const docApplier = (change: DocChange<Bucket>) => {
    const documentStrategy = {
      [ChangeTypes.INSERT]: (bucket: Bucket) => CRUD.insert(bs, bucket),
      [ChangeTypes.UPDATE]: (bucket: Bucket) => CRUD.replace(bs, bds, history, bucket),
      [ChangeTypes.DELETE]: (bucket: Bucket) => CRUD.remove(bs, bds, history, bucket._id)
    };

    documentStrategy[change.changeType](change.resource);
  };

  return {
    syncs: [
      {
        watcher: {
          resourceType: ResourceType.DOCUMENT,
          watch: docWatcher
        },
        converter: {
          convert: docToRepConverter
        },
        applier: {
          resourceType: ResourceType.REPRESENTATIVE,
          apply: repApplier
        }
      },
      {
        watcher: {
          resourceType: ResourceType.REPRESENTATIVE,
          watch: repWatcher
        },
        converter: {
          convert: repToDocConverter
        },
        applier: {
          resourceType: ResourceType.DOCUMENT,
          apply: docApplier
        }
      }
    ],
    moduleName,
    subModuleName: "schema"
  };
};
