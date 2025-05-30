import {VCSynchronizerArgs} from "@spica-server/interface/versioncontrol";
import * as CRUD from "../crud";
import {EnvVarService} from "@spica-server/env_var/services";
import {EnvVar} from "@spica-server/interface/env_var";

export const getSynchronizer = (evs: EnvVarService): VCSynchronizerArgs<EnvVar> => ({
  syncs: [
    {
      watcher: {collectionService: evs}
    },
    {
      converter: {resourceType: "document"},
      applier: {
        insert: (envVar: EnvVar) => CRUD.insert(evs, envVar),
        update: (envVar: EnvVar) => CRUD.replace(evs, envVar),
        delete: (envVar: EnvVar) => CRUD.remove(evs, envVar._id)
      }
    }
  ],
  moduleName: "env-var",
  subModuleName: "schema"
});
