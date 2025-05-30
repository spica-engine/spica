import {Injectable} from "@nestjs/common";
import {
  ChangeTypes,
  DocChange,
  RepChange,
  Resource,
  ResourceType,
  Synchronizer,
  VCSynchronizerArgs
} from "@spica-server/interface/versioncontrol";
import {VCRepresentativeManager} from "@spica-server/representative";
import YAML from "yaml";
import {ChangeStreamDocument, ObjectId} from "@spica-server/database";
import {Observable} from "rxjs";

@Injectable()
export class VCSynchronizer<R1 extends Resource, R2 extends Resource> extends Synchronizer<R1, R2> {
  constructor(args: VCSynchronizerArgs<R1, R2>, vcRepresentativeManager: VCRepresentativeManager) {
    const docSync = args.syncs[0];

    const service = docSync.watcher.service;

    const collectionWatcher = () => {
      return new Observable<DocChange<R1>>(observer => {
        const changeStream = service._coll.watch([], {
          fullDocument: "updateLookup"
        });

        changeStream.on("change", (change: ChangeStreamDocument<R1>) => {
          let changeType: ChangeTypes;
          let resource: R1;

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
              resource = {_id: change.documentKey._id} as unknown as R1;
              break;

            default:
              return;
          }

          const docChange: DocChange<R1> = {
            resourceType: ResourceType.DOCUMENT,
            changeType,
            resource
          };

          observer.next(docChange);
        });

        changeStream.on("error", err => observer.error(err));
        changeStream.on("close", () => observer.complete());

        service._coll
          .find()
          .toArray()
          .then(resources => {
            resources.forEach(resource => {
              const docChange: DocChange<R1> = {
                resourceType: ResourceType.DOCUMENT,
                changeType: ChangeTypes.INSERT,
                resource: resource as R1
              };

              observer.next(docChange);
            });
          });

        return () => changeStream.close();
      });
    };

    const docWatcher = docSync.watcher.docWatcher ? docSync.watcher.docWatcher : collectionWatcher;

    const repSync = args.syncs[1];

    const filesToWatch = repSync.watcher.filesToWatch.map(file => `${file.name}.${file.extension}`);

    const repWatcher = () =>
      vcRepresentativeManager.watch(args.moduleName, filesToWatch, repSync.watcher.eventsToWatch);

    const repToDocConverter = (change: RepChange<R2>): DocChange<R1> => {
      const parsed = change.resource.content ? YAML.parse(change.resource.content) : {};

      const documentResource = {...parsed, _id: new ObjectId(change.resource._id)};
      const fileResource = {
        _id: change.resource._id,
        fn: {_id: new ObjectId(change.resource._id)},
        content: change.resource.content
      };

      const resource =
        repSync.converter.resourceType == "document" ? documentResource : fileResource;

      return {
        changeType: change.changeType,
        resourceType: ResourceType.DOCUMENT,
        resource
      };
    };

    const docApplier = async (change: DocChange<R1>): Promise<void> => {
      const documentStrategy = {
        [ChangeTypes.INSERT]: repSync.applier.insert,
        [ChangeTypes.UPDATE]: repSync.applier.update,
        [ChangeTypes.DELETE]: repSync.applier.delete
      };

      await documentStrategy[change.changeType](change.resource);
    };

    const syncs = [
      {
        watcher: {
          resourceType: ResourceType.DOCUMENT,
          watch: docWatcher
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
    ];

    const synchronizerArgs = {
      syncs,
      moduleName: args.moduleName,
      subModuleName: args.subModuleName
    };

    super(synchronizerArgs);
  }
}
