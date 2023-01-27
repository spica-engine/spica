import {ConfigExporter, getPathsOfSchema} from "@spica-client/asset/helpers";
import {take} from "lodash";
import {ApiKeyService} from "../services/apikey.service";

export function provideAssetFactory(resource) {
  if (resource.module == "preference" && resource._id == "identity") {
    return "passport/settings";
  } else if (resource.module == "apikey") {
    return `passport/apikey/${resource._id}/edit`;
  }

  return false;
}

export function provideApikeyAssetConfigExporter(as: ApiKeyService) {
  const configExporter = new ConfigExporter();

  const typeLoader = () =>
    Promise.resolve([
      {value: "string", title: "String"},
      {value: "boolean", title: "Boolean"},
      {value: "number", title: "Number"}
    ]);

  const propertyLoader = async selections => {
    const apikey = await as.get(selections.resource_id).toPromise();

    delete apikey._id;

    return getPathsOfSchema(apikey).map(prop => {
      return {
        value: prop,
        title: prop
      };
    });
  };

  const resourceIdLoader = () =>
    as
      .getAll(0, 0, {_id: -1})
      .toPromise()
      .then(({data: apikeys}) =>
        apikeys.map(d => {
          return {value: d._id, title: d.name};
        })
      );

  const subModuleLoader = () => Promise.resolve([{title: "Schema", value: "schema"}]);

  return configExporter.build({
    moduleName: "apikey",
    exporters: {
      name: "submodule",
      loadOptions: subModuleLoader,
      children: {
        name: "resource_id",
        loadOptions: resourceIdLoader,
        children: {
          name: "property",
          loadOptions: propertyLoader,
          children: {
            name: "type",
            loadOptions: typeLoader
          }
        }
      }
    }
  });
}
