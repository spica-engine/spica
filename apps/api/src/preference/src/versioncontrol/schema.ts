import {ObjectId} from "@spica/database";
import {PreferenceService} from "@spica-server/preference/services";
import {SyncProvider} from "@spica-server/versioncontrol";
import {IRepresentativeManager} from "@spica/interface";

export const getSyncProvider = (
  prefService: PreferenceService,
  manager: IRepresentativeManager
): SyncProvider => {
  const name = "identity-schema";
  const module = "preference";

  const getAll = () =>
    prefService.get("passport").then(s => {
      return [{...s.identity}];
    });

  const upsert = schema => {
    delete schema._id;
    return prefService.updateOne({scope: "passport"}, {$set: {identity: schema}}, {upsert: true});
  };
  const insert = upsert;
  const update = upsert;

  const remove = async () => {
    await prefService.updateOne(
      {scope: "passport"},
      {
        $set: {
          identity: {
            attributes: {}
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
    return manager.write(module, "identity", "schema", schema, "yaml");
  };

  const rm = schema => manager.rm(module, schema._id);

  const readAll = async () => {
    const resourceNameValidator = name => name == "identity";
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
