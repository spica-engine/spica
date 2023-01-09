import {InjectionToken} from "@angular/core";

export interface Asset {
  _id?: string;
  name: string;
  description: string;
  resources: Resource[];
  status: Status;
  configs: Config[];
  failure_message?: string;
  url: string;
  icon: string;
}

export type Status = "downloaded" | "installed" | "failed";

export interface Config {
  module: string;
  resource_id: string;
  submodule: string;
  property: string;
  value: unknown;
  type: string;
  title: string;
}

export interface Resource<C = object> {
  _id: string;
  module: string;
  contents: C;
}

export interface InstallationPreview {
  insertions: Resource[];
  updations: Resource[];
  deletions: Resource[];
}

export interface InstallationPreviewByModules {
  [module: string]: {
    insertions: Resource[];
    updations: Resource[];
    deletions: Resource[];
  };
}

export interface ExportMeta {
  name: string;
  description: string;
  configs: Config[];
  resources: ExportResource;
  url: string;
}

export interface ExportResource {
  [module: string]: string[];
}

export interface AvailableResources {
  [module: string]: {title: string; _id: string}[];
}

export const ASSET_CONFIG_EXPORTER = new InjectionToken<any>("ASSET_CONFIG_EXPORTER");

export interface Selectable {
  name: string;
  value: any;
  title: string;
  onSelect?: (...args) => Promise<Selectable[]>;
  isLast?: boolean;
}
