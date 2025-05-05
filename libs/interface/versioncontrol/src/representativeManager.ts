import {Observable} from "rxjs";

enum ChangeTypes {
  INSERT,
  UPDATE,
  DELETE
}

enum ResourceType {
  DOCUMENT,
  REPRESENTATIVE
}

interface Resource {
  [key: string]: any;
}

interface Change<R extends Resource> {
  resourceType: ResourceType;
  changeType: ChangeTypes;
  resource: R;
}

interface DocChange<R extends Resource = Resource> extends Change<R> {
  resourceType: ResourceType.DOCUMENT;
}

interface RepChange<R extends Resource = Resource> extends Change<R> {
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
  apply(change: RC): void;
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

abstract class Synchronizer<R1 extends Resource, R2 extends Resource> {
  constructor(
    private syncs: [DocSync<R1, R2>, RepSync<R1, R2>],
    private moduleName: string,
    private subModuleName: string
  ) {}

  start() {
    const errorHandler = err => {
      console.error(
        `Error received while listening ${this.moduleName}.${this.subModuleName} changes.`
      );
      console.error(err);
    };

    // can't loop since array elements are different
    const docSync = this.syncs[0];
    docSync.watcher.watch().subscribe({
      next: change => {
        const convertedChange = docSync.converter.convert(change);
        docSync.applier.apply(convertedChange);
      },
      error: errorHandler
    });

    const repSync = this.syncs[1];
    repSync.watcher.watch().subscribe({
      next: change => {
        const convertedChange = repSync.converter.convert(change);
        repSync.applier.apply(convertedChange);
      },
      error: errorHandler
    });
  }
}
