import {Asset, Resource} from "@spica-server/interface/asset";
import {AssetService} from "./service";

export const ASSET_REP_MANAGER = Symbol.for("ASSET_REP_MANAGER");

export const ASSET_WORKING_DIRECTORY = Symbol.for("ASSET_WORKING_DIRECTORY");

export const INSTALLATION_STRATEGIES = Symbol.for("INSTALLATION_STRATEGIES");

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

  isMyTask(currentAsset: Asset, previousAssets: Asset[]): boolean;

  getChanges(): {
    insertions: Resource<object>[];
    updations: Resource<object>[];
    deletions: Resource<object>[];
  };

  afterInstall(resources: Resource[]): Asset[];
}
