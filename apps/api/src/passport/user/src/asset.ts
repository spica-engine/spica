import {registrar} from "@spica-server/asset";
import {Resource} from "@spica-server/interface/asset";
import {PreferenceService} from "@spica-server/preference/services";
import {IRepresentativeManager} from "@spica-server/interface/representative";
import {UserSettingsContents} from "@spica-server/interface/passport/user";

/**
 * Preference has 2 sub modules named bucket(not yet) and user
 * So we should also check the _id of the resource since it explains that preference for user or bucket
 * It's a bit different than the other modules
 */
const _module = "preference";

function isUserPreference(resourceOrId: Resource<UserSettingsContents> | string) {
  return typeof resourceOrId == "string" ? resourceOrId == "user" : resourceOrId._id == "user";
}

export function registerAssetHandlers(
  prefService: PreferenceService,
  manager: IRepresentativeManager
) {
  const validator = async () => {
    await Promise.resolve(true);
  };

  registrar.validator(_module, validator);

  const upsert = async (resource: Resource<UserSettingsContents>) => {
    if (!isUserPreference(resource)) {
      return;
    }

    const existing = await prefService.get("passport");
    const attributes = mergeAttributes(
      existing.user.attributes,
      resource.contents.schema.attributes
    );

    return prefService.updateOne({scope: "passport"}, {$set: {user: {attributes}}}, {upsert: true});
  };

  const remove = async resource => {
    if (!isUserPreference(resource)) {
      return;
    }

    const existing = await prefService.get("passport");
    const attributes = extractAttributes(
      existing.user.attributes,
      resource.contents.schema.attributes
    );

    return prefService.updateOne({scope: "passport"}, {$set: {user: {attributes}}});
  };

  const operator = {
    insert: upsert,
    update: upsert,
    delete: remove
  };

  registrar.operator(_module, operator);

  const exporter = async (_id: string) => {
    if (!isUserPreference(_id)) {
      return;
    }

    const schema = await prefService.get("passport").then(s => {
      return s.user;
    });

    return manager.write(_module, "user", "schema", schema, "yaml");
  };

  registrar.exporter(_module, exporter);
}

function mergeAttributes(attributes1, attributes2) {
  return {
    ...(attributes1 || {}),
    ...(attributes2 || {})
  };
}

function extractAttributes(from, to) {
  const attributes = {};
  Object.entries(from).forEach(([key, value]) => {
    if (!Object.keys(to).includes(key)) {
      attributes[key] = value;
    }
  });

  return attributes;
}
