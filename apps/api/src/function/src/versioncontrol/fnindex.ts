import {FunctionService} from "@spica-server/function/services";
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

export const getIndexSynchronizer = (
  fs: FunctionService,
  engine: FunctionEngine
): VCSynchronizerArgs<FunctionChange> => {
  const fileName = "index";

  const docWatcher = () =>
    new Observable<DocChange<FunctionChange>>(observer => {
      engine.watch("index").subscribe({
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

  const apply = (resource: FunctionChange) =>
    CRUD.index.write(fs, engine, resource.fn._id, resource.content);

  return {
    syncs: [
      {
        watcher: {docWatcher},
        converter: {
          resource: change => ({
            _id: change.resource.fn._id.toString(),
            content: change.resource.content,
            additionalParameters: {language: change.resource.fn.language}
          })
        },
        applier: {
          fileName,
          extension: change =>
            change.resource.additionalParameters.language == "javascript" ? "js" : "ts"
        }
      },
      {
        watcher: {
          filesToWatch: [
            {name: "index", extension: "js"},
            {name: "index", extension: "ts"}
          ],
          eventsToWatch: ["add", "change"]
        },
        converter: {resourceType: "file"},
        applier: {
          insert: apply,
          update: apply,
          delete: () => {}
        }
      }
    ],
    moduleName: "function",
    subModuleName: "index"
  };
};
