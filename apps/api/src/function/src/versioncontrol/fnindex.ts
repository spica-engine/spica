import {FunctionService} from "@spica-server/function/services";
import {
  ChangeTypes,
  DocChange,
  RepChange,
  ResourceType,
  SynchronizerArgs
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
): SynchronizerArgs<FunctionChange, RepresentativeManagerResource> => {
  const moduleName = "function";

  const docWatcher = () => {
    return new Observable<DocChange<FunctionChange>>(observer => {
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
  };

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

  const repWatcher = () =>
    vcRepresentativeManager.watch(moduleName, ["index.js", "index.ts"], ["add", "change"]);

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

  const docApplier = (change: DocChange<FunctionChange>) =>
    CRUD.index.write(fs, engine, change.resource.fn._id, change.resource.content);

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
    subModuleName: "index"
  };
};
