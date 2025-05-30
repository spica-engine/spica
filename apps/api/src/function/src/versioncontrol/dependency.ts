import {FunctionService} from "@spica-server/function/services";
import {
  ChangeTypes,
  DocChange,
  RepChange,
  ResourceType,
  SynchronizerArgs,
  VCSynchronizerArgs
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
): VCSynchronizerArgs<FunctionChange, RepresentativeManagerResource> => {
  const moduleName = "function";
  const fileName = "schema";
  const extension = "yaml";

  const docWatcher = () =>
    new Observable<DocChange<FunctionChange>>(observer => {
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

  const apply = (resource: FunctionChange) => {
    const parsed = JSON.parse(resource.content);
    return CRUD.dependencies.update(engine, {
      ...resource.fn,
      dependencies: parsed.dependencies
    });
  };

  return {
    syncs: [
      {
        watcher: {
          docWatcher
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
          filesToWatch: [{name: fileName, extension}],
          eventsToWatch: ["add", "change"]
        },
        converter: {
          resourceType: "file"
        },
        applier: {
          insert: apply,
          update: apply,
          delete: () => {}
        }
      }
    ],
    moduleName,
    subModuleName: "dependency"
  };
};
