import {Observable} from "rxjs";
import {BaseCollection} from "@spica-server/database";
import {CommandType, ICommander, IJobReducer} from "@spica-server/interface/replication";

export enum ChangeTypes {
  INSERT,
  UPDATE,
  DELETE
}

export enum ResourceType {
  DOCUMENT,
  REPRESENTATIVE
}

export interface Resource {
  [key: string]: any;
}

interface Change<R extends Resource> {
  resourceType: ResourceType;
  changeType: ChangeTypes;
  resource: R;
}

export interface DocChange<R extends Resource = Resource> extends Change<R> {
  resourceType: ResourceType.DOCUMENT;
}

export interface RepChange<R extends Resource = Resource> extends Change<R> {
  resourceType: ResourceType.REPRESENTATIVE;
}

interface Converter<
  Src extends Resource,
  Target extends Resource,
  In extends Change<Src> = Change<Src>,
  Out extends Change<Target> = Change<Target>
> {
  convert(change: In): Out;
}

type DocToRepConverter<Src extends Resource, Target extends Resource> = Converter<
  Src,
  Target,
  DocChange<Src>,
  RepChange<Target>
>;
type RepToDocConverter<Src extends Resource, Target extends Resource> = Converter<
  Src,
  Target,
  RepChange<Src>,
  DocChange<Target>
>;

interface Watcher<R extends Resource, T extends ResourceType, RC extends Change<R> = Change<R>> {
  resourceType: T;
  watch(): Observable<RC>;
}

interface Applier<R extends Resource, RT extends ResourceType, RC extends Change<R> = Change<R>> {
  resourceType: RT;
  apply(change: RC): Promise<any>;
}

type DocWatcher<R extends Resource> = Watcher<R, ResourceType.DOCUMENT, DocChange<R>>;
type RepWatcher<R extends Resource> = Watcher<R, ResourceType.REPRESENTATIVE, RepChange<R>>;

type DocApplier<R extends Resource> = Applier<R, ResourceType.DOCUMENT, DocChange<R>>;
type RepApplier<R extends Resource> = Applier<R, ResourceType.REPRESENTATIVE, RepChange<R>>;

interface Sync<
  Src extends Resource,
  SrcType extends ResourceType,
  Target extends Resource,
  TargetType extends ResourceType,
  C extends Converter<Src, Target>,
  W extends Watcher<Src, SrcType> = Watcher<Src, SrcType>,
  A extends Applier<Target, TargetType> = Applier<Target, TargetType>
> {
  watcher: W;
  converter: C;
  applier: A;
}

export type DocSync<Src extends Resource, Target extends Resource> = Sync<
  Src,
  ResourceType.DOCUMENT,
  Target,
  ResourceType.REPRESENTATIVE,
  DocToRepConverter<Src, Target>,
  DocWatcher<Src>,
  RepApplier<Target>
>;

export type RepSync<Src extends Resource, Target extends Resource> = Sync<
  Src,
  ResourceType.REPRESENTATIVE,
  Target,
  ResourceType.DOCUMENT,
  RepToDocConverter<Src, Target>,
  RepWatcher<Src>,
  DocApplier<Target>
>;

export type SynchronizerArgs<R1 extends Resource, R2 extends Resource> = {
  syncs: [DocSync<R1, R2>, RepSync<R2, R1>];
  moduleName: string;
  subModuleName: string;
  jobReducer?: IJobReducer;
  commander?: ICommander;
};

export abstract class Synchronizer<R1 extends Resource, R2 extends Resource> {
  constructor(private args: SynchronizerArgs<R1, R2>) {
    if (args.commander) {
      args.commander.register(
        this,
        [this.addDocToRepAction, this.addRepToDocAction],
        CommandType.SYNC
      );
    }
  }

  docToRepActions = new Set<string>();
  repToDocActions = new Set<string>();

  addDocToRepAction(resourceId: string) {
    this.docToRepActions.add(resourceId);
  }
  addRepToDocAction(resourceId: string) {
    this.repToDocActions.add(resourceId);
  }

  start() {
    const {syncs, moduleName, subModuleName, jobReducer} = this.args;

    const errorHandler = err => {
      console.error(`Error received while listening ${moduleName}.${subModuleName} changes.`);
      console.error(err);
    };

    // can't loop since array elements are different
    const docSync = syncs[0];
    docSync.watcher.watch().subscribe({
      next: change => {
        const resourceId = change.resource._id.toString();

        const isSynchronizerAction = this.repToDocActions.has(resourceId);
        if (isSynchronizerAction) {
          return this.repToDocActions.delete(resourceId);
        }

        this.addDocToRepAction(resourceId);

        const apply = () => {
          const convertedChange = docSync.converter.convert(change);
          docSync.applier.apply(convertedChange);
        };

        if (jobReducer) {
          const meta = {_id: `doc-rep:${moduleName}:${subModuleName}:${resourceId}`};
          jobReducer.do(meta, apply);
        } else {
          apply();
        }
      },
      error: errorHandler
    });

    const repSync = syncs[1];
    repSync.watcher.watch().subscribe({
      next: change => {
        const resourceId = change.resource._id;

        const isSynchronizerAction = this.docToRepActions.has(resourceId);
        if (isSynchronizerAction) {
          return this.docToRepActions.delete(resourceId);
        }

        this.addRepToDocAction(resourceId);

        const apply = () => {
          const convertedChange = repSync.converter.convert(change);

          const retry = (delays: number[]) => {
            repSync.applier.apply(convertedChange).catch(err => {
              delays.length
                ? new Promise(res => setTimeout(res, delays[0])).then(() => retry(delays.slice(1)))
                : console.error(
                    "Failed to apply changes from doc to rep for the following change:\n",
                    convertedChange,
                    "\nreason:\n",
                    err
                  );
            });
          };

          retry([2000, 4000, 8000]);
        };

        if (jobReducer) {
          const meta = {_id: `rep-doc:${moduleName}:${subModuleName}:${resourceId}`};
          jobReducer.do(meta, apply);
        } else {
          apply();
        }
      },
      error: errorHandler
    });
  }
}

export type RepresentativeManagerResource = {
  _id: string;
  content: string;
  additionalParameters?: {[key: string]: string | number};
};

export type VCSynchronizerArgs<R1 extends Resource> = Omit<
  SynchronizerArgs<R1, RepresentativeManagerResource>,
  "syncs"
> & {
  syncs: [
    {
      watcher:
        | {
            collectionService: BaseCollection<R1>;
            docWatcher?: never;
          }
        | {
            collectionService?: never;
            docWatcher: () => Observable<DocChange<R1>>;
          };
      converter: {
        convertToRepResource: (change: DocChange<R1>) => RepresentativeManagerResource;
      };
      applier: {
        fileName: string;
        getExtension: (change: RepChange<RepresentativeManagerResource>) => string;
      };
    },
    {
      watcher: {filesToWatch: {name: string; extension: string}[]; eventsToWatch?: string[]};
      converter: {
        convertToDocResource: (change: RepChange<RepresentativeManagerResource>) => R1;
      };
      applier: {
        insert: (resource: R1) => unknown;
        update: (resource: R1) => unknown;
        delete: (resource: R1) => unknown;
      };
    }
  ];
};

export type RegisterVCSynchronizer<R1 extends Resource> = (
  args: VCSynchronizerArgs<R1>
) => Synchronizer<R1, RepresentativeManagerResource>;

export const REGISTER_VC_SYNCHRONIZER = Symbol.for("REGISTER_VC_SYNCHRONIZER");

export const VC_REPRESENTATIVE_MANAGER = Symbol.for("VC_REPRESENTATIVE_MANAGER");
