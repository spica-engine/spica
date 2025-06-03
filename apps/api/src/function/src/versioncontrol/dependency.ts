import {
  ChangeTypes,
  DocChange,
  ResourceType,
  VCSynchronizerArgs
} from "@spica-server/interface/versioncontrol";
import {FunctionEngine} from "../engine";
import {FunctionChange} from "@spica-server/interface/function";
import {Observable} from "rxjs";
import * as CRUD from "../crud";

export const getDependencySynchronizer = (
  engine: FunctionEngine
): VCSynchronizerArgs<FunctionChange> => {
  const fileName = "package";
  const extension = "json";

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
        },
        converter: {
          resource: (change: DocChange<FunctionChange>) => {
            const parsed = JSON.parse(change.resource.content);
            const dependencies = parsed.dependencies || {};

            return {
              _id: change.resource.fn._id.toString(),
              content: JSON.stringify({dependencies})
            };
          }
        },
        applier: {fileName, extension}
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
    moduleName: "function",
    subModuleName: "dependency"
  };
};
