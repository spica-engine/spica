import {FunctionService} from "@spica-server/function/services";
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
import {
  Function,
  FunctionContentChange,
  FunctionWithContent
} from "@spica-server/interface/function";
import {Observable} from "rxjs";
import * as CRUD from "../crud";
import {ObjectId} from "bson";

export const getIndexSynchronizer = (
  fs: FunctionService,
  engine: FunctionEngine
): VCSynchronizerArgs<FunctionWithContent> => {
  const fileName = "index";

  const docWatcher = () =>
    new Observable<DocChange<DocumentManagerResource<FunctionWithContent>>>(observer => {
      engine.watch("index").subscribe({
        next: ({fn: change, changeType}: FunctionContentChange) => {
          const docChange: DocChange<DocumentManagerResource<FunctionWithContent>> = {
            resourceType: ResourceType.DOCUMENT,
            changeType: changeType == "add" ? ChangeTypes.INSERT : ChangeTypes.UPDATE,
            resource: {
              _id: change._id.toString(),
              slug: change.name,
              content: {...change, content: change.content}
            }
          };

          observer.next(docChange);
        },
        error: observer.error
      });
    });

  const convertToRepResource = change => ({
    _id: change.resource._id || change.resource.content._id?.toString(),
    slug: change.resource.slug || change.resource.content.name,
    content: change.resource.content.content,
    additionalParameters: {language: change.resource.content.language}
  });

  const convertToDocResource = (change: RepChange<RepresentativeManagerResource>) =>
    ({
      _id: new ObjectId(change.resource._id),
      content: change.resource.content
    }) as FunctionWithContent;

  const apply = (resource: FunctionWithContent) =>
    CRUD.index.write(fs, engine, resource._id, resource.content);

  return {
    syncs: [
      {
        watcher: {docWatcher},
        converter: {convertToRepResource},
        applier: {
          fileName,
          getExtension: change =>
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
        converter: {convertToDocResource},
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
