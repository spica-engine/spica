export interface Asset {
  _id?: any;
  name: string;
  description: string;
  resources: Resource[];
  status: Status;
  configs: Config[];
  url: string;
  icon: string;
}

export type Status = "downloaded" | "installed" | "partially_installed";

export interface Config {
  title: string;
  module: string;
  resource_id: string;
  submodule: string;
  property: string;
  value?: unknown;
  type: string;
}

export interface Resource<C = object> {
  _id: any;
  module: string;
  contents: C;
  installation_status?: "installed" | "failed";
  failure_message?: string;
}

export type Validator = (resource: Resource) => Promise<void>;

export interface Operator {
  insert(resource: Resource): Promise<any>;
  update(resource: Resource): Promise<any>;
  delete(resource: Resource): Promise<any>;
}

export type Exporter = (_id: string) => Promise<void>;

export interface ExportMeta {
  name: string;
  description: string;
  resources: {[_module: string]: string[]};
  configs: Config[];
}

export type ResourceLister = () => Promise<{_id: string; title: string}[]>;

export interface AssetOptions {
  persistentPath: string;
}

export interface InstallationChanges {
  insertions: Resource[];
  updations: Resource[];
  deletions: Resource[];
}

export interface IInstallationStrategy {
  asset: Asset;
  previousAsset: Asset;
  changes: InstallationChanges;

  isMyTask(currentAsset: Asset, allVersions: Asset[]): boolean;

  getChanges(): {
    insertions: Resource<object>[];
    updations: Resource<object>[];
    deletions: Resource<object>[];
  };

  afterInstall(resources: Resource[]): Asset[];
}

export const ASSET_REP_MANAGER = Symbol.for("ASSET_REP_MANAGER");

export const ASSET_WORKING_DIRECTORY = Symbol.for("ASSET_WORKING_DIRECTORY");

export const INSTALLATION_STRATEGIES = Symbol.for("INSTALLATION_STRATEGIES");
