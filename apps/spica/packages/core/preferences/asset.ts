import {ConfigExporter, getPathsOfSchema} from "@spica-client/asset/helpers";
import {take} from "rxjs/operators";
import {PreferencesService} from "./preferences.service";

export const assetConfigExporter = (ps: PreferencesService) => {
  const configExporter = new ConfigExporter();

  const typeLoader = () =>
    Promise.resolve([
      {value: "string", title: "String"},
      {value: "boolean", title: "Boolean"},
      {value: "number", title: "Number"}
    ]);

  const propertyLoader = async () => {
    const pref = await ps.get("passport").pipe(take(1)).toPromise();

    const copy = JSON.parse(JSON.stringify(pref));
    delete copy.scope;
    delete copy._id;
    delete copy.identity.attributes.type;

    return getPathsOfSchema(copy).map(prop => {
      return {
        value: prop,
        title: prop
      };
    });
  };

  const resourceIdLoader = () => {
    return Promise.resolve([{value: "identity", title: "Identity"}]);
  };

  const loadSubModules = () => Promise.resolve([{title: "Schema", value: "schema"}]);

  return configExporter.build({
    moduleName: "preference",
    exporters: {
      name: "submodule",
      loadOptions: loadSubModules,
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
};

export const listResources = () => Promise.resolve([{_id: "identity", title: "Identity"}]);
