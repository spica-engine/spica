import {BucketService} from "@spica-server/bucket/services";
import {Bucket} from "@spica-server/interface/bucket";
import {
  IRepresentativeManager,
  RepresentativeManagerResource
} from "@spica-server/interface/representative";
import {
  ChangeTypes,
  DocChange,
  ResourceType,
  SynchronizerArgs,
  SyncProvider
} from "@spica-server/interface/versioncontrol";
import {ChangeStreamDocument, ObjectId} from "mongodb";
import {Observable} from "rxjs";
import YAML from "yaml";

export const getSynchronizer = (
  bs: BucketService,
  provider: SyncProvider,
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

  const docConverter = change => {
    return {
      ...change,
      resourceType: ResourceType.REPRESENTATIVE,
      resource: {
        _id: change.resource._id.toString(),
        content: YAML.stringify(change.resource)
      }
    };
  };

  const docApplier = change => {
    const {representative} = provider;

    const representativeStrategy = {
      [ChangeTypes.INSERT]: representative.insert,
      [ChangeTypes.UPDATE]: representative.update,
      [ChangeTypes.DELETE]: representative.delete
    };

    representativeStrategy[change.changeType](change.resource);
  };

  const repWatcher = () => vcRepresentativeManager.watch(moduleName);

  const repConverter = change => {
    const parsed = change.resource.content ? YAML.parse(change.resource.content) : {};

    return {
      ...change,
      resourceType: ResourceType.DOCUMENT,
      resource: {...parsed, _id: new ObjectId(change.resource._id)}
    };
  };

  const repApplier = change => {
    const {document} = provider;

    const documentStrategy = {
      [ChangeTypes.INSERT]: document.insert,
      [ChangeTypes.UPDATE]: document.update,
      [ChangeTypes.DELETE]: document.delete
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
          convert: docConverter
        },
        applier: {
          resourceType: ResourceType.REPRESENTATIVE,
          apply: docApplier
        }
      },
      {
        watcher: {
          resourceType: ResourceType.REPRESENTATIVE,
          watch: repWatcher
        },
        converter: {
          convert: repConverter
        },
        applier: {
          resourceType: ResourceType.DOCUMENT,
          apply: repApplier
        }
      }
    ],
    moduleName,
    subModuleName: ""
  };
};
