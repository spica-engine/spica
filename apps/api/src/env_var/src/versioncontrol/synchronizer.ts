import {
  ChangeTypes,
  DocChange,
  getDisplayableName,
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

  const convertToRepResource = (change: DocChange<EnvVar>) => ({
    _id: change.resource._id.toString(),
    slug: change.resource.key,
    content: YAML.stringify(change.resource)
  });

  const convertToDocResource = (change: RepChange<RepresentativeManagerResource>) => {
    const parsed = change.resource.content ? YAML.parse(change.resource.content) : {};
    return {...parsed, _id: new ObjectId(change.resource._id)};
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
