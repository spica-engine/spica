import {ConfigExporter, listEditableProps} from "@spica-client/asset/helpers";
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

    return listEditableProps(pref).map(prop => {
      return {
        value: prop,
        title: prop
      };
    });
  };

  const resourceIdLoader = () => {
    return Promise.resolve([{value: "identity", title: "Identity"}]);
  };

  const subModuleLoader = () => Promise.resolve([{title: "Schema", value: "schema"}]);

  return configExporter.build({
    moduleName: "preference",
    exporters: {
      name: "submodule",
      loader: subModuleLoader,
      children: {
        name: "resource_id",
        loader: resourceIdLoader,
        children: {
          name: "property",
          loader: propertyLoader,
          children: {
            name: "type",
            loader: typeLoader
          }
        }
      }
    }
  });
};
