import {Asset, Configuration} from "@spica-server/interface/asset";

export function putConfiguration(asset: Asset, configs: Configuration[]) {
  configs = eliminateNonConfigurables(asset.configs, configs);

  for (let config of configs) {
    asset.resources = asset.resources.map(resource => {
      if (resource.module != config.module) {
        return resource;
      }

      if (resource._id.toString() != config.resource_id) {
        return resource;
      }

      const val = resource.contents[config.submodule];
      const property = config.property;
      const replace = config.value;

      resource.contents[config.submodule] = replaceValue(val, property, replace);

      return resource;
    });
  }

  asset.configs = configs;
  return asset;
}

export function replaceValue(val: object, property: string, replace: unknown) {
  const segments = property.split(".");

  const target = segments[0];

  if (segments.length == 1) {
    val[target] = replace;
    return val;
  }

  property = segments.slice(1).join(".");
  val[target] = replaceValue(val[target], property, replace);

  return val;
}

export function eliminateNonConfigurables(
  actual: Configuration[],
  desired: Configuration[]
): Configuration[] {
  return desired.filter(d => {
    const isMatch = actual.some(
      a =>
        a.module == d.module &&
        a.resource_id == d.resource_id &&
        a.submodule == d.submodule &&
        a.property == d.property
    );
    return isMatch;
  });
}
