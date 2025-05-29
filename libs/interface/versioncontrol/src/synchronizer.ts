import {Observable} from "rxjs";

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
  apply(change: RC): void | Promise<any>;
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

type DocSync<Src extends Resource, Target extends Resource> = Sync<
  Src,
  ResourceType.DOCUMENT,
  Target,
  ResourceType.REPRESENTATIVE,
  DocToRepConverter<Src, Target>,
  DocWatcher<Src>,
  RepApplier<Target>
>;

type RepSync<Src extends Resource, Target extends Resource> = Sync<
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
};

export abstract class Synchronizer<R1 extends Resource, R2 extends Resource> {
  constructor(private args: SynchronizerArgs<R1, R2>) {}

  docToRepActions = new Set<string>();
  repToDocActions = new Set<string>();

  start() {
    const {syncs, moduleName, subModuleName} = this.args;

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

        this.docToRepActions.add(resourceId);

        const convertedChange = docSync.converter.convert(change);
        docSync.applier.apply(convertedChange);
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

        this.repToDocActions.add(resourceId);

        const convertedChange = repSync.converter.convert(change);

        const retry = async (delays: number[]) => {
          try {
            await repSync.applier.apply(convertedChange);
          } catch (err) {
            delays.length
              ? new Promise(res => setTimeout(res, delays[0])).then(() => retry(delays.slice(1)))
              : console.error("Error applying after retries:", err);
          }
        };

        retry([2000, 4000, 8000]);
      },
      error: errorHandler
    });
  }
}

export type RegisterVCSynchronizer<R1 extends Resource, R2 extends Resource> = (
  args: SynchronizerArgs<R1, R2>
) => Synchronizer<R2, R1>;

export const REGISTER_VC_SYNCHRONIZER = Symbol.for("REGISTER_VC_SYNCHRONIZER");

export const VC_REPRESENTATIVE_MANAGER = Symbol.for("VC_REPRESENTATIVE_MANAGER");
