import {ObjectId} from "@spica-server/database";
import {PreferenceService} from "@spica-server/preference/services";
import {IRepresentativeManager, SyncProvider} from "@spica-server/versioncontrol";

export const getSyncProvider = (
  prefService: PreferenceService,
  manager: IRepresentativeManager
): SyncProvider => {
  //@TODO: check the name convension
  const name = "identity-schema";
  const module = "preference";

  const getAll = () =>
    prefService.get("passport").then(s => {
      return [{...s.identity, _id: "identity"}];
    });

  const upsert = schema => {
    delete schema._id;
    return prefService.updateOne({scope: "passport"}, {$set: {identity: schema}}, {upsert: true});
  };
  const insert = upsert;
  const update = upsert;

  //@TODO: check why we don't have remove method on preference service
  const remove = async () => {
    await prefService.updateOne(
      {scope: "passport"},
      {
        $set: {
          identity: {
            attributes: {
              properties: {}
            }
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
    console.log(schema);
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
