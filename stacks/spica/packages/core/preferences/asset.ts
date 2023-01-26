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
    let pref: any = await ps
      .get("passport")
      .pipe(take(1))
      .toPromise();

    delete pref.scope;
    delete pref._id;
    delete pref.identity.attributes.type;

    return getPathsOfSchema(pref).map(prop => {
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
