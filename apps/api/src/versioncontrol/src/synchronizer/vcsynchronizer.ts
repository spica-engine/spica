import {Injectable} from "@nestjs/common";
import {
  DocSync,
  RepSync,
  Resource,
  ResourceType,
  Synchronizer,
  SynchronizerArgs,
  VCSynchronizerArgs
} from "@spica-server/interface/versioncontrol";
import {VCRepresentativeManager} from "@spica-server/representative";
import {RepresentativeManagerResource} from "@spica-server/interface/versioncontrol";
import {getDocToRepConverter, getDocWatcher, getRepApplier} from "./doc.synchronizer";
import {getDocApplier, getRepToDocConverter, getRepWatcher} from "./rep.synchronizer";
import {JobReducer} from "@spica-server/replication";

@Injectable()
export class VCSynchronizer<R extends Resource> extends Synchronizer<
  R,
  RepresentativeManagerResource
> {
  constructor(
    args: VCSynchronizerArgs<R>,
    vcRepresentativeManager: VCRepresentativeManager,
    jobReducer?: JobReducer
  ) {
    const docSync = args.syncs[0];

    const docWatcher = getDocWatcher<R>(docSync.watcher);
    const docToRepConverter = getDocToRepConverter<R>(docSync.converter);
    const repApplier = getRepApplier(vcRepresentativeManager, args.moduleName, docSync.applier);

    const repSync = args.syncs[1];

    const repWatcher = getRepWatcher(vcRepresentativeManager, args.moduleName, repSync.watcher);
    const repToDocConverter = getRepToDocConverter<R>(repSync.converter);
    const docApplier = getDocApplier<R>(repSync.applier);

    const syncs: [
      DocSync<R, RepresentativeManagerResource>,
      RepSync<RepresentativeManagerResource, R>
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

    const synchronizerArgs: SynchronizerArgs<R, RepresentativeManagerResource> = {
      syncs,
      moduleName: args.moduleName,
      subModuleName: args.subModuleName,
      jobReducer
    };

    super(synchronizerArgs);
  }
}
