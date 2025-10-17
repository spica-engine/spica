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

interface Change<R extends ManagerResource<any>> {
  resourceType: ResourceType;
  changeType: ChangeTypes;
  resource: R;
}

export interface DocChange<R extends ManagerResource<any> = ManagerResource<any>>
  extends Change<R> {
  resourceType: ResourceType.DOCUMENT;
}

export interface RepChange<R extends ManagerResource<any> = ManagerResource<any>>
  extends Change<R> {
  resourceType: ResourceType.REPRESENTATIVE;
}

interface Converter<
  Src extends ManagerResource<any>,
  Target extends ManagerResource<any>,
  In extends Change<Src> = Change<Src>,
  Out extends Change<Target> = Change<Target>
> {
  convert(change: In): Out;
}

type DocToRepConverter<
  Src extends ManagerResource<any>,
  Target extends ManagerResource<any>
> = Converter<Src, Target, DocChange<Src>, RepChange<Target>>;
type RepToDocConverter<
  Src extends ManagerResource<any>,
  Target extends ManagerResource<any>
> = Converter<Src, Target, RepChange<Src>, DocChange<Target>>;

interface Watcher<
  R extends ManagerResource<any>,
  T extends ResourceType,
  RC extends Change<R> = Change<R>
> {
  resourceType: T;
  watch(): Observable<RC>;
}

interface Applier<
  R extends ManagerResource<any>,
  RT extends ResourceType,
  RC extends Change<R> = Change<R>
> {
  resourceType: RT;
  apply(change: RC): Promise<any>;
}

type DocWatcher<R extends ManagerResource<any>> = Watcher<R, ResourceType.DOCUMENT, DocChange<R>>;
type RepWatcher<R extends ManagerResource<any>> = Watcher<
  R,
  ResourceType.REPRESENTATIVE,
  RepChange<R>
>;

type DocApplier<R extends ManagerResource<any>> = Applier<R, ResourceType.DOCUMENT, DocChange<R>>;
type RepApplier<R extends ManagerResource<any>> = Applier<
  R,
  ResourceType.REPRESENTATIVE,
  RepChange<R>
>;

interface Sync<
  Src extends ManagerResource<any>,
  SrcType extends ResourceType,
  Target extends ManagerResource<any>,
  TargetType extends ResourceType,
  C extends Converter<Src, Target>,
  W extends Watcher<Src, SrcType> = Watcher<Src, SrcType>,
  A extends Applier<Target, TargetType> = Applier<Target, TargetType>
> {
  watcher: W;
  converter: C;
  applier: A;
}

export type DocSync<Src extends ManagerResource<any>, Target extends ManagerResource<any>> = Sync<
  Src,
  ResourceType.DOCUMENT,
  Target,
  ResourceType.REPRESENTATIVE,
  DocToRepConverter<Src, Target>,
  DocWatcher<Src>,
  RepApplier<Target>
>;

export type RepSync<Src extends ManagerResource<any>, Target extends ManagerResource<any>> = Sync<
  Src,
  ResourceType.REPRESENTATIVE,
  Target,
  ResourceType.DOCUMENT,
  RepToDocConverter<Src, Target>,
  RepWatcher<Src>,
  DocApplier<Target>
>;

export type SynchronizerArgs<R1 extends ManagerResource<any>, R2 extends ManagerResource<any>> = {
  syncs: [DocSync<R1, R2>, RepSync<R2, R1>];
  moduleName: string;
  subModuleName: string;
  jobReducer?: IJobReducer;
  commander?: ICommander;
};

export interface ChangeMeta {
  id?: string;
  slug?: string;
  changeType: ChangeTypes;
  module: string;
  submodule: string;
}

export abstract class Synchronizer<
  R1 extends ManagerResource<any>,
  R2 extends ManagerResource<any>
> {
  constructor(private args: SynchronizerArgs<R1, R2>) {
    if (args.commander) {
      args.commander.register(
        this,
        [
          this.addDocToRepAction,
          this.addRepToDocAction,
          this.removeDocToRepAction,
          this.removeRepToDocAction
        ],
        CommandType.SYNC
      );
    }
  }

  private idSlugMap = new Map<string, string>();
  private slugIdMap = new Map<string, string>();

  docToRepActions = new Set<ChangeMeta>();
  repToDocActions = new Set<ChangeMeta>();

  addDocToRepAction(meta: ChangeMeta) {
    this.docToRepActions.add(meta);

    if (meta.id && meta.slug) {
      const idStr = String(meta.id);

      this.storeIdSlugMapping(idStr, meta.slug);
    }
  }

  addRepToDocAction(meta: ChangeMeta) {
    this.repToDocActions.add(meta);

    if (meta.id && meta.slug) {
      const idStr = String(meta.id);

      this.storeIdSlugMapping(idStr, meta.slug);
    }
  }

  removeDocToRepAction(meta: ChangeMeta) {
    for (const action of this.docToRepActions) {
      if (this.compareMetaActions(action, meta)) {
        this.docToRepActions.delete(action);
        break;
      }
    }
  }

  removeRepToDocAction(meta: ChangeMeta) {
    for (const action of this.repToDocActions) {
      if (this.compareMetaActions(action, meta)) {
        this.repToDocActions.delete(action);
        break;
      }
    }
  }

  storeIdSlugMapping(id: string, slug: string) {
    this.idSlugMap.set(id, slug);
    this.slugIdMap.set(slug, id);
  }

  getSlugFromId(id: string): string | undefined {
    return this.idSlugMap.get(id);
  }

  getIdFromSlug(slug: string): string | undefined {
    return this.slugIdMap.get(slug);
  }

  private resolveIdAndSlug(
    resourceId?: string,
    slug?: string
  ): {resourceId?: string; slug?: string} {
    let id = resourceId;

    if (!slug && id) {
      const mapped = this.getSlugFromId(id);
      if (mapped) slug = mapped;
    }

    if (!id && slug) {
      const mappedId = this.getIdFromSlug(slug);
      if (mappedId) id = mappedId;
    }

    if (id && slug) {
      this.storeIdSlugMapping(id, slug);
    }
    return {resourceId: id, slug};
  }

  private compareMetaActions(action1: ChangeMeta, action2: ChangeMeta): boolean {
    if (action1.module !== action2.module || action1.submodule !== action2.submodule) {
      return false;
    }

    if (action1.id && action2.id) {
      return action1.id === action2.id;
    }

    if (action1.slug && action2.slug) {
      return action1.slug === action2.slug;
    }

    if (action1.id && action2.slug) {
      const slug1 = this.getSlugFromId(action1.id);
      return slug1 === action2.slug;
    }

    if (action1.slug && action2.id) {
      const id1 = this.getIdFromSlug(action1.slug);
      return id1 === action2.id;
    }
    return false;
  }

  private hasMatchingAction(meta: ChangeMeta, actions: Set<ChangeMeta>): boolean {
    for (const action of actions) {
      if (this.compareMetaActions(action, meta)) {
        return true;
      }
    }
    return false;
  }

  errorHandler = err => {
    console.error(
      `Error received while listening ${this.args.moduleName}.${this.args.subModuleName} changes.`
    );
    console.error(err);
  };

  start() {
    const {syncs, moduleName, subModuleName, jobReducer} = this.args;

    // can't loop since array elements are different
    const docSync = syncs[0];

    const docSyncNext = (change: DocChange<R1>, resourceId: string, slug?: string) => {
      // Generate meta for this change
      const meta: ChangeMeta = {
        id: resourceId,
        slug,
        changeType: change.changeType,
        module: moduleName,
        submodule: subModuleName
      };

      const isSynchronizerAction = this.hasMatchingAction(meta, this.repToDocActions);

      if (isSynchronizerAction) {
        return this.removeRepToDocAction(meta);
      }

      this.addDocToRepAction(meta);

      // Update the change with resolved resourceId and slug
      const updatedChange: DocChange<R1> = {
        ...change,
        resource: {
          ...change.resource,
          _id: resourceId,
          slug: slug
        }
      };

      const convertedChange = docSync.converter.convert(updatedChange);

      docSync.applier.apply(convertedChange).catch(this.errorHandler);
    };

    docSync.watcher.watch().subscribe({
      next: change => {
        const rawResourceId = change.resource._id;
        const rawSlug =
          change.resource.slug ||
          (change.resource.content as any)?.title ||
          (change.resource.content as any)?.name;

        const resolved = this.resolveIdAndSlug(rawResourceId, rawSlug);
        const resourceId = resolved.resourceId;
        const slug = resolved.slug;

        if (jobReducer) {
          const meta = {_id: `doc-rep:${moduleName}:${subModuleName}:${resourceId || slug}`};
          jobReducer.do(meta, docSyncNext.bind(this, change, resourceId, slug));
        } else {
          docSyncNext(change, resourceId, slug);
        }
      },
      error: this.errorHandler
    });

    const repSync = syncs[1];

    const repSyncNext = (change: RepChange<R2>, resourceId: string, slug?: string) => {
      // Generate meta for this change
      const meta: ChangeMeta = {
        id: resourceId,
        slug,
        changeType: change.changeType,
        module: moduleName,
        submodule: subModuleName
      };

      const isSynchronizerAction = this.hasMatchingAction(meta, this.docToRepActions);

      if (isSynchronizerAction) {
        return this.removeDocToRepAction(meta);
      }

      this.addRepToDocAction(meta);

      // Update the change resource with resolved resourceId and slug
      const updatedChange: RepChange<R2> = {
        ...change,
        resource: {
          ...change.resource,
          _id: resourceId,
          slug: slug || change.resource.slug
        }
      };

      const convertedChange = repSync.converter.convert(updatedChange);

      const retry = (delays: number[]) => {
        repSync.applier.apply(convertedChange).catch(err => {
          delays.length
            ? new Promise(res => setTimeout(res, delays[0])).then(() => retry(delays.slice(1)))
            : console.error(
                "Failed to apply changes from rep to doc for the following change:\n",
                convertedChange,
                "\nreason:\n",
                err
              );
        });
      };

      retry([2000, 4000, 8000]);
    };

    repSync.watcher.watch().subscribe({
      next: change => {
        const rawResourceId = change.resource._id;
        const rawSlug = change.resource.slug;

        const resolved = this.resolveIdAndSlug(rawResourceId, rawSlug);
        const resourceId = resolved.resourceId;
        const slug = resolved.slug;

        if (jobReducer) {
          const meta = {_id: `rep-doc:${moduleName}:${subModuleName}:${resourceId || slug}`};
          jobReducer.do(meta, repSyncNext.bind(this, change, resourceId, slug));
        } else {
          repSyncNext(change, resourceId, slug);
        }
      },
      error: this.errorHandler
    });
  }
}

export type RepresentativeManagerResource = ManagerResource<string>;
export type DocumentManagerResource<T extends any> = ManagerResource<T>;

export type ManagerResource<T> = {
  _id?: string;
  slug?: string;
  content: T;
  additionalParameters?: {[key: string]: string | number};
};

export type VCSynchronizerArgs<R1 extends Resource> = Omit<
  SynchronizerArgs<DocumentManagerResource<R1>, RepresentativeManagerResource>,
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
            docWatcher: () => Observable<DocChange<DocumentManagerResource<R1>>>;
          };
      converter: {
        convertToRepResource: (
          change: DocChange<DocumentManagerResource<R1>>
        ) => RepresentativeManagerResource;
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
) => Synchronizer<DocumentManagerResource<R1>, RepresentativeManagerResource>;

export const REGISTER_VC_SYNCHRONIZER = Symbol.for("REGISTER_VC_SYNCHRONIZER");

export const VC_REPRESENTATIVE_MANAGER = Symbol.for("VC_REPRESENTATIVE_MANAGER");
