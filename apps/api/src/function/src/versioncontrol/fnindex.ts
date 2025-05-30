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
import {FunctionChange, Function, EnvRelation} from "@spica-server/interface/function";
import {
  IRepresentativeManager,
  RepresentativeManagerResource
} from "@spica-server/interface/representative";
import {Observable} from "rxjs";
import {ObjectId} from "mongodb";
import * as CRUD from "../crud";

export const getIndexSynchronizer = (
  fs: FunctionService,
  vcRepresentativeManager: IRepresentativeManager,
  engine: FunctionEngine
): VCSynchronizerArgs<FunctionChange, RepresentativeManagerResource> => {
  const moduleName = "function";

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

  const docToRepConverter = (
    change: DocChange<FunctionChange>
  ): RepChange<RepresentativeManagerResource> => {
    return {
      changeType: change.changeType,
      resourceType: ResourceType.REPRESENTATIVE,
      resource: {
        _id: change.resource.fn._id.toString(),
        content: change.resource.content,
        additionalParameters: {language: change.resource.fn.language}
      }
    };
  };

  const repApplier = (change: RepChange<RepresentativeManagerResource>) => {
    const extension = change.resource.additionalParameters.language == "javascript" ? "js" : "ts";
    vcRepresentativeManager.write(
      moduleName,
      change.resource._id,
      "index",
      change.resource.content,
      extension
    );
  };

  const apply = (resource: FunctionChange) =>
    CRUD.index.write(fs, engine, resource.fn._id, resource.content);

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
          filesToWatch: [
            {name: "index", extension: "js"},
            {name: "index", extension: "ts"}
          ],
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
    subModuleName: "index"
  };
};
