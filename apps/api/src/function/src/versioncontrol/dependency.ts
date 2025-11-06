import {
  ChangeTypes,
  DocChange,
  DocumentManagerResource,
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
import {FunctionService} from "@spica-server/function/services";

export const getDependencySynchronizer = (
  fs: FunctionService,
  engine: FunctionEngine
): VCSynchronizerArgs<FunctionWithContent> => {
  const fileName = "package";
  const extension = "json";

  const docWatcher = () =>
    new Observable<DocChange<DocumentManagerResource<FunctionWithContent>>>(observer => {
      CRUD.find(fs, engine, {}).then(async functions => {
        for (const fn of functions) {
          const content = await engine.readIndex(fn, "dependency");
          const fnWithContent: FunctionWithContent = {...fn, content};
          const docChange: DocChange<DocumentManagerResource<FunctionWithContent>> = {
            resourceType: ResourceType.DOCUMENT,
            changeType: ChangeTypes.INSERT,
            resource: {
              _id: fn._id.toString(),
              slug: fn.name,
              content: fnWithContent
            }
          };
          observer.next(docChange);
        }
      });

      engine.watch("dependency").subscribe({
        next: (change: FunctionWithContent) => {
          const docChange: DocChange<DocumentManagerResource<FunctionWithContent>> = {
            resourceType: ResourceType.DOCUMENT,
            changeType: ChangeTypes.INSERT,
            resource: {
              _id: change._id.toString(),
              slug: change.name,
              content: change
            }
          };

          observer.next(docChange);
        },
        error: observer.error
      });
    });

  const convertToRepResource = (
    change: DocChange<DocumentManagerResource<FunctionWithContent>>
  ) => {
    const parsed = JSON.parse(change.resource.content.content);
    const dependencies = parsed.dependencies || {};

    return {
      _id: change.resource._id || change.resource.content._id?.toString(),
      slug: change.resource.slug || change.resource.content.name,
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
