import {FunctionService} from "@spica-server/function/services";
import {
  ChangeTypes,
  DocChange,
  ResourceType,
  VCSynchronizerArgs
} from "@spica-server/interface/versioncontrol";
import {FunctionEngine} from "../engine";
import {Function, FunctionWithContent} from "@spica-server/interface/function";
import {Observable} from "rxjs";
import * as CRUD from "../crud";

export const getIndexSynchronizer = (
  fs: FunctionService,
  engine: FunctionEngine
): VCSynchronizerArgs<FunctionWithContent> => {
  const fileName = "index";

  const docWatcher = () =>
    new Observable<DocChange<FunctionWithContent>>(observer => {
      engine.watch("index").subscribe({
        next: (change: FunctionWithContent) => {
          const docChange: DocChange<FunctionWithContent> = {
            resourceType: ResourceType.DOCUMENT,
            changeType: ChangeTypes.INSERT,
            resource: {...change, content: change.content}
          };

          observer.next(docChange);
        },
        error: observer.error
      });
    });

  const convertToRepResource = change => ({
    _id: change.resource._id.toString(),
    content: change.resource.content,
    additionalParameters: {language: change.resource.language}
  });

  const apply = (resource: FunctionWithContent) =>
    CRUD.index.write(fs, engine, resource._id, resource.content);

  return {
    syncs: [
      {
        watcher: {docWatcher},
        converter: {convertToRepResource},
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
