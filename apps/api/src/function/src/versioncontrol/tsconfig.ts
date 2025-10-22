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
import {ObjectId} from "bson";

export const getTsconfigSynchronizer = (
  engine: FunctionEngine
): VCSynchronizerArgs<FunctionWithContent> => {
  const fileName = "tsconfig";
  const extension = "json";

  const docWatcher = () =>
    new Observable<DocChange<DocumentManagerResource<FunctionWithContent>>>(observer => {
      engine.watch("tsconfig").subscribe({
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

    return {
      _id: change.resource._id || change.resource.content._id?.toString(),
      slug: change.resource.slug || change.resource.content.name,
      content: JSON.stringify(parsed)
    };
  };

  const convertToDocResource = (change: RepChange<RepresentativeManagerResource>) =>
    ({
      _id: new ObjectId(change.resource._id),
      content: change.resource.content
    }) as FunctionWithContent;

  return {
    syncs: [
      {
        watcher: {docWatcher},
        converter: {convertToRepResource},
        applier: {
          fileName,
          getExtension: () => extension,
          getAccessMode: () => "readonly"
        }
      },
      {
        watcher: {
          filesToWatch: [{name: fileName, extension}],
          eventsToWatch: ["add", "change"]
        },
        converter: {convertToDocResource},
        // These applier methods are intentionally no-ops because tsconfig files are read-only.
        // Modifications (insert, update, delete) are ignored.
        applier: {
          insert: () => {},
          update: () => {},
          delete: () => {}
        }
      }
    ],
    moduleName: "function",
    subModuleName: "tsconfig"
  };
};
