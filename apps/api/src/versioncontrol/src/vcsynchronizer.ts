import {Injectable} from "@nestjs/common";
import {
  ChangeTypes,
  DocChange,
  DocSync,
  RepChange,
  RepSync,
  Resource,
  ResourceType,
  Synchronizer,
  SynchronizerArgs,
  VCSynchronizerArgs
} from "@spica-server/interface/versioncontrol";
import {VCRepresentativeManager} from "@spica-server/representative";
import YAML from "yaml";
import {ChangeStreamDocument, ObjectId} from "@spica-server/database";
import {Observable} from "rxjs";
import {RepresentativeManagerResource} from "@spica-server/interface/versioncontrol";

@Injectable()
export class VCSynchronizer<R1 extends Resource> extends Synchronizer<
  R1,
  RepresentativeManagerResource
> {
  constructor(args: VCSynchronizerArgs<R1>, vcRepresentativeManager: VCRepresentativeManager) {
    const docSync = args.syncs[0];

    const service = docSync.watcher.collectionService;

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

    const docToRepConverter = (change: DocChange<R1>): RepChange<RepresentativeManagerResource> => {
      return {
        changeType: change.changeType,
        resourceType: ResourceType.REPRESENTATIVE,
        resource: docSync.converter?.resource(change) || {
          _id: change.resource._id.toString(),
          content: YAML.stringify(change.resource)
        }
      };
    };

    const repApplier = (change: RepChange<RepresentativeManagerResource>) => {
      const fileName = docSync.applier?.fileName || "schema";

      const getExtension = () => {
        if (!docSync.applier) {
          return "yaml";
        }

        if (typeof docSync.applier.extension == "function") {
          return docSync.applier.extension(change);
        }

        return docSync.applier.extension;
      };

      const write = (resource: RepresentativeManagerResource) => {
        return vcRepresentativeManager.write(
          args.moduleName,
          resource._id,
          fileName,
          resource.content,
          getExtension()
        );
      };

      const rm = (resource: RepresentativeManagerResource) => {
        return vcRepresentativeManager.rm(args.moduleName, resource._id);
      };

      const representativeStrategy = {
        [ChangeTypes.INSERT]: write,
        [ChangeTypes.UPDATE]: write,
        [ChangeTypes.DELETE]: rm
      };

      return representativeStrategy[change.changeType](change.resource);
    };

    const repSync = args.syncs[1];

    const filesToWatch = repSync.watcher
      ? repSync.watcher.filesToWatch.map(file => `${file.name}.${file.extension}`)
      : ["schema.yaml"];

    const repWatcher = () =>
      vcRepresentativeManager.watch(args.moduleName, filesToWatch, repSync.watcher?.eventsToWatch);

    const repToDocConverter = (change: RepChange<RepresentativeManagerResource>): DocChange<R1> => {
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

    const syncs: [
      DocSync<R1, RepresentativeManagerResource>,
      RepSync<RepresentativeManagerResource, R1>
    ] = [
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
    ];

    const synchronizerArgs: SynchronizerArgs<R1, RepresentativeManagerResource> = {
      syncs,
      moduleName: args.moduleName,
      subModuleName: args.subModuleName
    };

    super(synchronizerArgs);
  }
}
