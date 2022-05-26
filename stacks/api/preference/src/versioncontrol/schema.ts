import {ObjectId} from "@spica-server/database";
import {PreferenceService} from "@spica-server/preference/services";
import {IRepresentativeManager, SyncProvider} from "@spica-server/versioncontrol";

export const getSyncProvider = (
  prefService: PreferenceService,
  manager: IRepresentativeManager
): SyncProvider => {
  //@TODO: check the name convension
  const name = "identity-schema";
  const module = "identity";

  const getAll = () => prefService.get("passport").then(s => [s]);
  const insert = schema => prefService.insertOne(schema);
  const update = async schema => {
    await prefService.replace({scope: "passport"}, schema);
  };

  //@TODO: check why we don't have remove method on preference service
  const remove = async () => {
    await prefService.replace(
      {scope: "passport"},
      {
        scope: "passport",
        identity: {
          attributes: {
            properties: {}
          }
        }
      }
    );
  };

  const document = {
    getAll,
    insert,
    update,
    delete: remove
  };

  const write = schema => {
    schema._id = schema._id.toString();
    return manager.write(module, schema._id, "schema", schema, "yaml");
  };

  const rm = schema => manager.rm(module, schema._id);

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
