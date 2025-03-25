import {ObjectId, ReturnDocument} from "@spica-server/database";
import {EnvVarsService} from "@spica-server/env_var/services";
import {IRepresentativeManager} from "@spica-server/interface/representative";
import {SyncProvider} from "@spica-server/versioncontrol";
import * as CRUD from "../crud";

export const getVCSyncProvider = (
  evs: EnvVarsService,
  manager: IRepresentativeManager
): SyncProvider => {
  const name = "env-var-schema";
  const module = "env-var";

  const getAll = () =>
    evs.find().then(envs =>
      envs.map(e => {
        return {
          ...e,
          _id: e._id.toHexString()
        };
      })
    );

  const insert = envVar => CRUD.insert(evs, envVar);

  const update = envVar => CRUD.replace(evs, envVar);

  const remove = envVar => CRUD.remove(evs, envVar._id);

  const document = {
    getAll,
    insert,
    update,
    delete: remove
  };

  const write = envVar => {
    envVar._id = envVar._id.toString();
    return manager.write(module, envVar._id, "schema", envVar, "yaml");
  };

  const rm = envVar => manager.rm(module, envVar._id);

  const readAll = async () => {
    const resourceNameValidator = id => ObjectId.isValid(id);
    const files = await manager.read(module, resourceNameValidator, ["schema.yaml"]);
    return files.map(file => file.contents.schema);
  };

  const representative = {
    getAll: readAll,
    insert: write,
    update: write,
    delete: rm
  };

  return {
    name,
    document,
    representative,
    parents: 0
  };
};
