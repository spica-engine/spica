import {
  Config,
  InstallationPreview,
  InstallationPreviewByModules,
  Resource,
  Selectable
} from "./interfaces";

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

export function displayPreview(resources: any[]) {
  const data = JSON.stringify(resources, null, 2);
  const x = window.open();
  x.document.open();
  x.document.write("<html><body><pre>" + data + "</pre></body></html>");
  x.document.close();
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

export function listEditableProps(schema: object) {
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
    const target = visit(value, [key]);
    Array.isArray(target) ? targets.push(...target) : targets.push(target);
  }

  return targets;
}

interface moduleConfigExporterOption {
  value: string;
  title: string;
}

export interface Exporter {
  name: string;
  loader: (currentSelections: {[name: string]: string}) => Promise<moduleConfigExporterOption[]>;
  children?: Exporter;
}
export interface moduleConfigExporter {
  moduleName: string;
  exporters: Exporter;
}

export class ConfigExporter {
  selections: {[name: string]: string} = {};

  build(moduleConfigExporter: moduleConfigExporter) {
    const visit = (exporter: Exporter, parentName: string) => {
      const onSelect = async selection => {
        this.selections[parentName] = selection;
        const options = await exporter.loader(this.selections);

        const selectables: Selectable[] = [];
        for (const option of options) {
          const selectable: Selectable = {
            name: exporter.name,
            title: option.title,
            value: option.value
          };

          if (exporter.children) {
            selectable.onSelect = visit(exporter.children, exporter.name);
          } else {
            selectable.isLast = true;
            selectable.onSelect = () => Promise.resolve([]);
          }

          selectables.push(selectable);
        }
        return selectables;
      };
      return onSelect;
    };

    return {
      name: "module",
      title: moduleConfigExporter.moduleName,
      value: moduleConfigExporter.moduleName,
      onSelect: visit(moduleConfigExporter.exporters, "module")
    } as Selectable;
  }
}
