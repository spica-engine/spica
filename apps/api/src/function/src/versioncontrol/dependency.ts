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

export const getDependencySynchronizer = (
  engine: FunctionEngine
): VCSynchronizerArgs<FunctionWithContent> => {
  const fileName = "package";
  const extension = "json";

  const docWatcher = () =>
    new Observable<DocChange<DocumentManagerResource<FunctionWithContent>>>(observer => {
      engine.watch("dependency").subscribe({
        next: ({fn}) => {
          const docChange: DocChange<DocumentManagerResource<FunctionWithContent>> = {
            resourceType: ResourceType.DOCUMENT,
            changeType: ChangeTypes.INSERT,
            resource: {
              _id: fn._id.toString(),
              slug: fn.name,
              content: fn
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
    const functionName = change.resource.content.name;
    const language = change.resource.content.language;
    const dependencies = parsed.dependencies || {};
    const devDependencies = parsed.devDependencies || {};

    if (language == "typescript" && !devDependencies.typescript) {
      devDependencies.typescript = "^5.0.0";
    }
    const buildMjsDir = `../.build/${functionName}/index.mjs`;
    const buildJsDir = `../.build/${functionName}/index.js`;

    let buildScript = `mkdir -p ../.build/${functionName} && ln -sf ./node_modules ../.build/${functionName}/node_modules`;
    switch (language) {
      case "javascript":
        buildScript = `&& cp index.mjs ${buildMjsDir}`;
        break;
      case "typescript":
        buildScript = `&& tsc && mv ${buildJsDir} ${buildMjsDir}`;
        break;
      default:
        console.warn(
          `Unknown language "${language}" for function "${functionName}". Skipping build script generation.`
        );
        buildScript = "";
        break;
    }

    const packageJson = {
      ...parsed,
      dependencies,
      devDependencies,
      scripts: {
        ...parsed.scripts,
        build: buildScript
      }
    };

    return {
      _id: change.resource._id || change.resource.content._id?.toString(),
      slug: change.resource.slug || change.resource.content.name,
      content: JSON.stringify(packageJson)
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
