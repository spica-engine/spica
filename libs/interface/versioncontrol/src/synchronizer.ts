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

interface Change<R extends ManagerResource> {
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

export interface ChangeMeta {
  id?: string;
  slug?: string;
  changeType: ChangeTypes;
  module: string;
  submodule: string;
}

export abstract class Synchronizer<R1 extends Resource, R2 extends Resource> {
  constructor(private args: SynchronizerArgs<R1, R2>) {
    if (args.commander) {
      args.commander.register(
        this,
        [
          this.addDocToRepAction,
          this.addRepToDocAction,
          this.removeDocToRepAction,
          this.addRepToDocAction
        ],
        CommandType.SYNC
      );
    }
  }

  // Map to store id-slug pairs for resource identification
  private idSlugMap = new Map<string, string>(); // id -> slug
  private slugIdMap = new Map<string, string>(); // slug -> id

  // Updated action tracking using meta objects instead of just ids
  docToRepActions = new Set<ChangeMeta>();
  repToDocActions = new Set<ChangeMeta>();

  // New meta-based action tracking methods
  addDocToRepAction(meta: ChangeMeta) {
    this.docToRepActions.add(meta);

    // Store mapping when we have both id and slug
    if (meta.id && meta.slug) {
      const idStr = String(meta.id);

      this.storeIdSlugMapping(idStr, meta.slug);
    }
  }
  addRepToDocAction(meta: ChangeMeta) {
    this.repToDocActions.add(meta);

    // Store mapping when we have both id and slug
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
        // Remove from id-slug map to prevent memory leak
        if (action.id && action.slug) {
          this.idSlugMap.delete(action.id);
          this.slugIdMap.delete(action.slug);
        }
        break;
      }
    }
  }

  // Helper method to store id-slug mapping
  storeIdSlugMapping(id: string, slug: string) {
    this.idSlugMap.set(id, slug);
    this.slugIdMap.set(slug, id);
  }

  // Helper method to get slug from id
  getSlugFromId(id: string): string | undefined {
    return this.idSlugMap.get(id);
  }

  // Helper method to get id from slug
  getIdFromSlug(slug: string): string | undefined {
    return this.slugIdMap.get(slug);
  }

  // Resolve missing id or slug using the stored maps. If one side is present,
  // try to find the other. If both are found, persist the mapping.
  private resolveIdAndSlug(
    resourceId?: string,
    slug?: string
  ): {resourceId?: string; slug?: string} {
    let id = resourceId;

    // If slug is missing but id exists, try to lookup slug
    if (!slug && id) {
      const mapped = this.getSlugFromId(id);
      if (mapped) slug = mapped;
    }

    // If id is missing but slug exists, try to lookup id
    if (!id && slug) {
      const mappedId = this.getIdFromSlug(slug);
      if (mappedId) id = mappedId;
    }

    // If we have both now, store mapping
    if (id && slug) {
      this.storeIdSlugMapping(id, slug);
    }
    return {resourceId: id, slug};
  }

  // Helper method to compare meta actions for infinite synchronization prevention
  private compareMetaActions(action1: ChangeMeta, action2: ChangeMeta): boolean {
    // First check if they're from the same module/submodule
    if (action1.module !== action2.module || action1.submodule !== action2.submodule) {
      return false;
    }

    // If both have IDs, compare them directly
    if (action1.id && action2.id) {
      return action1.id === action2.id;
    }

    // If both have slugs, compare them directly
    if (action1.slug && action2.slug) {
      return action1.slug === action2.slug;
    }

    return false;
  }

  // Helper method to check if action exists and should be ignored
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
      console.log("doc to rep: isSynchronizerAction", isSynchronizerAction);
      if (isSynchronizerAction) {
        return this.removeRepToDocAction(meta);
      }

      this.addDocToRepAction(meta);

      const convertedChange = docSync.converter.convert(change);

      docSync.applier.apply(convertedChange).catch(this.errorHandler);
    };

    docSync.watcher.watch().subscribe({
      next: change => {
        const rawResourceId = change.resource._id;
        // const rawSlug = change.resource.slug;
        console.log("doc to rep sync: ", change);
        // console.log("rep rawResourceId:", rawResourceId, "rep rawSlug: ", rawSlug);
        const rawSlug = change.resource.slug || change.resource.title || change.resource.name;

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
      console.log("rep to doc: isSynchronizerAction", isSynchronizerAction);

      if (isSynchronizerAction) {
        return this.removeDocToRepAction(meta);
      }

      this.addRepToDocAction(meta);

      const convertedChange = repSync.converter.convert(change);

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
        console.log("rep to doc sync: ", change);
        // console.log("rep rawResourceId:", rawResourceId, "rep rawSlug: ", rawSlug);
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
) => Synchronizer<R1, RepresentativeManagerResource>;

export const REGISTER_VC_SYNCHRONIZER = Symbol.for("REGISTER_VC_SYNCHRONIZER");

export const VC_REPRESENTATIVE_MANAGER = Symbol.for("VC_REPRESENTATIVE_MANAGER");
