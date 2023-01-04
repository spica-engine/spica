import {listEditableProps} from "@spica-client/asset/helpers";
import {Selectable} from "@spica-client/asset/interfaces";
import {BucketService} from "./services/bucket.service";

export const assetConfigExporter = (bs: BucketService) => {
  const bucketModule: Selectable = {
    name: "module",
    value: "bucket",
    title: "Bucket",
    onSelect: async () => {
      const subModules = await Promise.resolve(["schema"]);
      return subModules.map(submodule => {
        return {
          name: "submodule",
          value: submodule,
          title: submodule,
          onSelect: async () => {
            const buckets = await bs.retrieve().toPromise();
            return buckets.map(b => {
              return {
                name: "resource_id",
                value: b._id,
                title: b.title,
                onSelect: async _id => {
                  const bucket = await Promise.resolve(b);
                  delete bucket._id;
                  const editableProps = listEditableProps(bucket);
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

  return bucketModule;
};
