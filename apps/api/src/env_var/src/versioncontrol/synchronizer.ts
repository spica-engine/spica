import {
  ChangeTypes,
  DocChange,
  DocumentManagerResource,
  RepChange,
  RepresentativeManagerResource,
  VCSynchronizerArgs
} from "@spica-server/interface/versioncontrol";
import * as CRUD from "../crud";
import {EnvVarService} from "@spica-server/env_var/services";
import {EnvVar} from "@spica-server/interface/env_var";
import YAML from "yaml";
import {ObjectId} from "bson";

export const getSynchronizer = (evs: EnvVarService): VCSynchronizerArgs<EnvVar> => {
  const fileName = "schema";
  const extension = "yaml";

  const convertToRepResource = (change: DocChange<DocumentManagerResource<EnvVar>>) => ({
    _id: change.resource._id || change.resource.content._id?.toString(),
    slug: change.resource.slug || change.resource.content.key,
    content: YAML.stringify(change.resource.content)
  });

  const convertToDocResource = (change: RepChange<RepresentativeManagerResource>) => {
    const parsed = change.resource.content ? YAML.parse(change.resource.content) : {};
    const id = parsed._id || change.resource._id;
    return {...parsed, _id: new ObjectId(id)};
  };

  return {
    syncs: [
      {
        watcher: {collectionService: evs},
        converter: {convertToRepResource},
        applier: {fileName, getExtension: () => extension}
      },
      {
        watcher: {filesToWatch: [{name: fileName, extension}]},
        converter: {convertToDocResource},
        applier: {
          insert: (envVar: EnvVar) => CRUD.insert(evs, envVar),
          update: (envVar: EnvVar) => CRUD.replace(evs, envVar),
          delete: (envVar: EnvVar) => CRUD.remove(evs, envVar._id)
        }
      }
    ],
    moduleName: "env-var",
    subModuleName: "schema"
  };
};
