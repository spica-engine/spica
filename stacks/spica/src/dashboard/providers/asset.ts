import {ConfigExporter, getPathsOfSchema} from "@spica-client/asset/helpers";
import {take} from "rxjs/operators";
import {DashboardService} from "../services/dashboard.service";

export function provideAssetFactory(resource) {
  if (resource.module != "dashboard") {
    return false;
  }

  return `dashboard/${resource._id}`;
}

export function provideAssetConfigExporter(ds: DashboardService) {
  const configExporter = new ConfigExporter();

  const typeLoader = () =>
    Promise.resolve([
      {value: "string", title: "String"},
      {value: "boolean", title: "Boolean"},
      {value: "number", title: "Number"}
    ]);

  const propertyLoader = async selections => {
    const dashboard = await ds
      .findOne(selections.resource_id)
      .pipe(take(1))
      .toPromise();

    const copy = JSON.parse(JSON.stringify(dashboard));
    delete copy._id;

    return getPathsOfSchema(copy).map(prop => {
      return {
        value: prop,
        title: prop
      };
    });
  };

  const resourceIdLoader = () =>
    ds
      .findAll()
      .pipe(take(1))
      .toPromise()
      .then(dashboards =>
        dashboards.map(d => {
          return {value: d._id, title: d.name};
        })
      );

  const subModuleLoader = () => Promise.resolve([{title: "Schema", value: "schema"}]);

  return configExporter.build({
    moduleName: "dashboard",
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

export const listResources = (ds: DashboardService) =>
  ds
    .findAll()
    .pipe(take(1))
    .toPromise()
    .then(dashboards => {
      return dashboards.map(dashboard => {
        return {_id: dashboard._id, title: dashboard.name};
      });
    });
