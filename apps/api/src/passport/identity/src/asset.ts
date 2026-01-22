import {registrar} from "@spica-server/asset";
import {Resource} from "@spica-server/interface/asset";
import {PreferenceService} from "@spica-server/preference/services";
import {IRepresentativeManager} from "@spica-server/interface/representative";
import {IdentitySettingsContents} from "@spica-server/interface/passport/identity";

/**
 * Preference has 2 sub modules named bucket(not yet) and identity
 * So we should also check the _id of the resource since it explains that preference for identity or bucket
 * It's a bit different than the other modules
 */
const _module = "preference";

function isIdentityPreference(resourceOrId: Resource<IdentitySettingsContents> | string) {
  return typeof resourceOrId == "string"
    ? resourceOrId == "identity"
    : resourceOrId._id == "identity";
}

export function registerAssetHandlers(
  prefService: PreferenceService,
  manager: IRepresentativeManager
) {
  const validator = async () => {
    await Promise.resolve(true);
  };

  registrar.validator(_module, validator);

  const upsert = async (resource: Resource<IdentitySettingsContents>) => {
    if (!isIdentityPreference(resource)) {
      return;
    }

    return Promise.resolve();
  };

  const remove = async resource => {
    if (!isIdentityPreference(resource)) {
      return;
    }

    return Promise.resolve();
  };

  const operator = {
    insert: upsert,
    update: upsert,
    delete: remove
  };

  registrar.operator(_module, operator);

  const exporter = async (_id: string) => {
    if (!isIdentityPreference(_id)) {
      return;
    }

    const schema = await prefService.get("passport").then(s => {
      return s.identity;
    });

    return manager.write(_module, "identity", "schema", schema, "yaml");
  };

  registrar.exporter(_module, exporter);
}
