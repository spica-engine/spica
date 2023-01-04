import {listEditableProps} from "@spica-client/asset/helpers";
import {Selectable} from "@spica-client/asset/interfaces";
import {FunctionService} from "./services/function.service";

export const assetConfigExporter = (fs: FunctionService) => {
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
                  let fn: any = await Promise.resolve(fns.find(f => f._id == _id));
                  delete fn._id;
                  if (submodule == "env") {
                    fn = fn.env;
                  }
                  const editableProps = listEditableProps(fn);
                  return Promise.resolve(
                    editableProps.map(k => {
                      return {
                        name: "property",
                        value: k,
                        title: k,
                        onSelect: () =>
                          Promise.resolve([
                            {
                              name: "type",
                              value: "string",
                              title: "String",
                              isLast: true,
                              onSelect: () => Promise.resolve([])
                            },
                            {
                              name: "type",
                              value: "number",
                              title: "Number",
                              isLast: true,
                              onSelect: () => Promise.resolve([])
                            },
                            {
                              name: "type",
                              value: "boolean",
                              title: "Boolean",
                              isLast: true,
                              onSelect: () => Promise.resolve([])
                            }
                          ])
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
