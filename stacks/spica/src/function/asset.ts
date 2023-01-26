import {ConfigExporter, listEditableProps} from "@spica-client/asset/helpers";
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
    let fn: any = await fs
      .getFunction(selections.resource_id)
      .pipe(take(1))
      .toPromise();

    delete fn._id;

    if (selections.submodule == "env") {
      fn = fn.env;
    }

    return listEditableProps(fn).map(prop => {
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
