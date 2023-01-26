import {ConfigExporter, getPathsOfSchema} from "@spica-client/asset/helpers";
import {take} from "rxjs/operators";
import {BucketService} from "./services/bucket.service";

export const assetConfigExporter = (bs: BucketService) => {
  const configExporter = new ConfigExporter();

  const typeLoader = () =>
    Promise.resolve([
      {value: "string", title: "String"},
      {value: "boolean", title: "Boolean"},
      {value: "number", title: "Number"}
    ]);

  const propertyLoader = async selections => {
    let bucket: any = await bs
      .getBucket(selections.resource_id)
      .pipe(take(1))
      .toPromise();

    delete bucket._id;

    return getPathsOfSchema(bucket).map(prop => {
      return {
        value: prop,
        title: prop
      };
    });
  };

  const resourceIdLoader = () => {
    return bs
      .getBuckets()
      .pipe(take(1))
      .toPromise()
      .then(buckets => {
        return buckets.map(fn => {
          return {value: fn._id, title: fn.title};
        });
      });
  };

  const subModuleLoader = () => Promise.resolve([{title: "Schema", value: "schema"}]);

  return configExporter.build({
    moduleName: "bucket",
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
