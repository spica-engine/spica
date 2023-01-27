import {ConfigExporter, getPathsOfSchema} from "@spica-client/asset/helpers";
import {take} from "rxjs/operators";
import {FunctionService} from "./services/function.service";

export const assetConfigExporter = (fs: FunctionService) => {
  const configExporter = new ConfigExporter();

  const typeLoader = () =>
    Promise.resolve([
      {value: "string", title: "String"},
      {value: "boolean", title: "Boolean"},
      {value: "number", title: "Number"}
    ]);

  const propertyLoader = async selections => {
    const fn = await fs
      .getFunction(selections.resource_id)
      .pipe(take(1))
      .toPromise();

    let copy = JSON.parse(JSON.stringify(fn));
    delete copy._id;

    if (selections.submodule == "env") {
      copy = copy.env;
    }

    return getPathsOfSchema(copy).map(prop => {
      return {
        value: prop,
        title: prop
      };
    });
  };

  const resourceIdLoader = () => {
    return fs
      .getFunctions()
      .pipe(take(1))
      .toPromise()
      .then(fns => {
        return fns.map(fn => {
          return {value: fn._id, title: fn.name};
        });
      });
  };

  const subModuleLoader = () =>
    Promise.resolve([
      {title: "Schema", value: "schema"},
      {title: "Environment Variable", value: "env"}
    ]);

  return configExporter.build({
    moduleName: "function",
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
};
