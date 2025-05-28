import {FunctionService} from "@spica-server/function/services";
import {
  ChangeTypes,
  DocChange,
  RepChange,
  ResourceType,
  SynchronizerArgs
} from "@spica-server/interface/versioncontrol";
import {FunctionEngine} from "../engine";
import {FunctionChange, Function, EnvRelation, Dependency} from "@spica-server/interface/function";
import {
  IRepresentativeManager,
  RepresentativeManagerResource
} from "@spica-server/interface/representative";
import {Observable} from "rxjs";
import {ObjectId} from "mongodb";
import * as CRUD from "../crud";

export const getDependencySynchronizer = (
  fs: FunctionService,
  vcRepresentativeManager: IRepresentativeManager,
  engine: FunctionEngine
): SynchronizerArgs<FunctionChange, RepresentativeManagerResource> => {
  const moduleName = "function";

  const docWatcher = () => {
    return new Observable<DocChange<FunctionChange>>(observer => {
      engine.watch("dependency").subscribe({
        next: (change: FunctionChange) => {
          const docChange: DocChange<FunctionChange> = {
            resourceType: ResourceType.DOCUMENT,
            changeType: ChangeTypes.INSERT,
            resource: change
          };

          observer.next(docChange);
        },
        error: observer.error
      });
    });
  };

  const docToRepConverter = (
    change: DocChange<FunctionChange>
  ): RepChange<RepresentativeManagerResource> => {
    const parsed = JSON.parse(change.resource.content);
    const dependencies = parsed.dependencies || {};

    return {
      changeType: change.changeType,
      resourceType: ResourceType.REPRESENTATIVE,
      resource: {
        _id: change.resource.fn._id.toString(),
        content: JSON.stringify({dependencies})
      }
    };
  };

  const repApplier = (change: RepChange<RepresentativeManagerResource>) => {
    vcRepresentativeManager.write(
      moduleName,
      change.resource._id,
      "package",
      change.resource.content,
      "json"
    );
  };

  const repWatcher = () =>
    vcRepresentativeManager.watch(moduleName, ["package.json"], ["add", "change"]);

  const repToDocConverter = (
    change: RepChange<RepresentativeManagerResource>
  ): DocChange<FunctionChange> => ({
    changeType: change.changeType,
    resourceType: ResourceType.DOCUMENT,
    resource: {
      _id: change.resource._id,
      fn: {_id: new ObjectId(change.resource._id)} as Function<EnvRelation.NotResolved>,
      content: change.resource.content
    }
  });

  const docApplier = (change: DocChange<FunctionChange>) => {
    const parsed = JSON.parse(change.resource.content);

    const update = () =>
      CRUD.dependencies.update(engine, {...change.resource.fn, dependencies: parsed.dependencies});

    const retry = (delays: number[]) =>
      update().catch(err =>
        delays.length
          ? new Promise(res => setTimeout(res, delays[0])).then(() => retry(delays.slice(1)))
          : console.error("Error updating dependencies after retries:", err)
      );

    retry([2000, 4000, 8000]);
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
    subModuleName: "dependency"
  };
};
