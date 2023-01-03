import {Selectable} from "@spica-client/asset/interfaces";
import {FunctionService} from "./services/function.service";

export const assetConfigExporter = async (fs: FunctionService) => {
  const functionModule: Selectable = {
    name: "module",
    value: "function",
    title: "Function",
    onSelect: async () => {
      const subModules = await Promise.resolve(["schema", "env"]);
      return subModules.map(submodule => {
        return {
          name: "submodule",
          value: submodule,
          title: submodule,
          onSelect: async () => {
            const fns = await fs.loadFunctions().toPromise();
            return fns.map(f => {
              return {
                name: "resource_id",
                value: f._id,
                title: f.name,
                onSelect: async _id => {
                  let fn: any = await fs.getFunction(_id).toPromise();
                  if (submodule == "env") {
                    fn = fn.env;
                  }

                  return Promise.resolve(
                    Object.keys(fn).map(k => {
                      return {
                        name: "property",
                        value: k,
                        title: k,
                        onSelect: () => Promise.resolve([])
                      };
                    })
                  );
                }
              };
            });
          }
        };
      });
    }
  };

  return functionModule;
};
