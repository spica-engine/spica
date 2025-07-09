import {
  ChangeTypes,
  DocChange,
  RepChange,
  RepresentativeManagerResource,
  ResourceType,
  VCSynchronizerArgs
} from "@spica-server/interface/versioncontrol";
import {FunctionEngine} from "../engine";
import {FunctionWithContent} from "@spica-server/interface/function";
import {Observable} from "rxjs";
import * as CRUD from "../crud";
import {ObjectId} from "bson";

export const getDependencySynchronizer = (
  engine: FunctionEngine
): VCSynchronizerArgs<FunctionWithContent> => {
  const fileName = "package";
  const extension = "json";

  const docWatcher = () =>
    new Observable<DocChange<FunctionWithContent>>(observer => {
      engine.watch("dependency").subscribe({
        next: (change: FunctionWithContent) => {
          const docChange: DocChange<FunctionWithContent> = {
            resourceType: ResourceType.DOCUMENT,
            changeType: ChangeTypes.INSERT,
            resource: change
          };

          observer.next(docChange);
        },
        error: observer.error
      });
    });

  const convertToRepResource = (change: DocChange<FunctionWithContent>) => {
    const parsed = JSON.parse(change.resource.content);
    const dependencies = parsed.dependencies || {};
    console.log(`${change.resource.name}(${change.resource._id.toString()})`);
    return {
      _id: `${change.resource.name}(${change.resource._id.toString()})`,
      content: JSON.stringify({dependencies})
    };
  };

  const convertToDocResource = (change: RepChange<RepresentativeManagerResource>) =>
    ({
      _id: new ObjectId(change.resource._id),
      content: change.resource.content
    }) as FunctionWithContent;

  const apply = (resource: FunctionWithContent) => {
    const parsed = JSON.parse(resource.content);
    return CRUD.dependencies.update(engine, {
      ...resource,
      dependencies: parsed.dependencies
    });
  };

  return {
    syncs: [
      {
        watcher: {docWatcher},
        converter: {convertToRepResource},
        applier: {fileName, getExtension: () => extension}
      },
      {
        watcher: {
          filesToWatch: [{name: fileName, extension}],
          eventsToWatch: ["add", "change"]
        },
        converter: {convertToDocResource},
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
