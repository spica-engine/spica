import {MatDialog} from "@angular/material/dialog";
import {
  Exporter,
  InstallationPreview,
  InstallationPreviewByModules,
  ModuleConfigExporter,
  Resource,
  Option
} from "./interfaces";
import {ResourcesComponent} from "./components/resources/resources.component";

export function separatePreviewResourcesByModule(
  preview: InstallationPreview
): InstallationPreviewByModules {
  const separatedPreview = {};
  const pushToPreview = (resource: Resource, action: "insertions" | "updations" | "deletions") => {
    separatedPreview[resource.module] = separatedPreview[resource.module] || getEmptyPreview();
    separatedPreview[resource.module][action].push(resource);
  };

  preview.insertions.forEach(resource => pushToPreview(resource, "insertions"));
  preview.updations.forEach(resource => pushToPreview(resource, "updations"));
  preview.deletions.forEach(resource => pushToPreview(resource, "deletions"));

  return separatedPreview;
}

export function getEmptyPreview(): InstallationPreview {
  return {
    insertions: [],
    updations: [],
    deletions: []
  };
}

export function displayPreview(dialog: MatDialog, resources: any[]) {
  dialog.open(ResourcesComponent, {
    data: resources,
    width: "30vw",
    minWidth: "400px",
    maxHeight: "calc(100vh - 15px)"
  });
}

export function getEmptyConfig() {
  return {
    title: undefined,
    module: undefined,
    submodule: undefined,
    resource_id: undefined,
    property: undefined,
    type: undefined,
    value: undefined
  };
}

export function getPathsOfSchema(schema: object): string[] {
  const visit = (value, paths = []) => {
    if (typeof value != "object" || Array.isArray(value)) {
      return paths.join(".");
    }

    const targets = [];
    for (let subkey in value) {
      const newPaths = paths.concat(...[subkey]);
      let target = visit(value[subkey], newPaths);
      Array.isArray(target) ? targets.push(...target) : targets.push(target);
    }

    return targets;
  };

  const targets = [];
  for (let [key, value] of Object.entries(schema)) {
    if (Array.isArray(value)) {
      continue;
    }

    const target = visit(value, [key]);
    Array.isArray(target) ? targets.push(...target) : targets.push(target);
  }

  return targets;
}

export class ConfigExporter {
  private selections: {[name: string]: string} = {};

  build(moduleConfigExporter: ModuleConfigExporter) {
    const visit = (exporter: Exporter, parentName: string) => {
      const onSelect = async selection => {
        this.selections[parentName] = selection;
        const rawOptions = await exporter.loadOptions(this.selections);

        const options: Option[] = [];
        for (const rawOption of rawOptions) {
          const option: Option = {
            name: exporter.name,
            title: rawOption.title,
            value: rawOption.value
          };

          if (exporter.children) {
            option.onSelect = visit(exporter.children, exporter.name);
          } else {
            option.isLast = true;
            option.onSelect = () => Promise.resolve([]);
          }

          options.push(option);
        }
        return options;
      };
      return onSelect;
    };

    return {
      name: "module",
      title: moduleConfigExporter.moduleName,
      value: moduleConfigExporter.moduleName,
      onSelect: visit(moduleConfigExporter.exporters, "module")
    } as Option;
  }
}
