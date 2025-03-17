import {ObjectId, ReturnDocument} from "@spica-server/database";
import {EnvVarsService} from "@spica-server/env_var/services";
import {IRepresentativeManager} from "@spica-server/interface/representative";
import {SyncProvider} from "@spica-server/versioncontrol";

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

  const insert = envVar => {
    if (envVar._id) {
      envVar._id = new ObjectId(envVar._id);
    }
    return evs.insertOne(envVar);
  };

  const update = envVar => {
    const id = new ObjectId(envVar._id);
    delete envVar._id;
    return evs.findOneAndReplace({_id: id}, envVar, {returnDocument: ReturnDocument.AFTER});
  };

  const remove = async envVar => {
    await evs.findOneAndDelete({_id: new ObjectId(envVar._id)});
  };

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
