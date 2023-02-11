import {compareResourceGroups} from "@spica-server/core/differ";
import {Asset, Resource} from "@spica-server/interface/asset";
import {IInstallationStrategy} from "./interface";

export abstract class InstallationStrategy implements IInstallationStrategy {
  asset: Asset;
  previousAsset: Asset;
  changes: {
    insertions: Resource<object>[];
    updations: Resource<object>[];
    deletions: Resource<object>[];
  };

  abstract isMyTask(currentAsset: Asset, previousAssets: Asset[]);

  abstract getChanges();

  abstract afterInstall(resources: Resource<object>[]);

  protected updateResources(resourcesAfterInstall: Resource[]) {
    for (let resource of this.asset.resources) {
      let resourceWithStatus: Resource<object> = resourcesAfterInstall.find(
        r => r._id.toString() == resource._id.toString()
      );

      if (!resourceWithStatus && this.previousAsset) {
        resourceWithStatus = this.previousAsset.resources.find(
          r => r._id.toString() == resource._id.toString()
        );
      }

      if (!resourceWithStatus) {
        continue;
      }

      resource.installation_status = resourceWithStatus.installation_status;
      if (resourceWithStatus.failure_message) {
        resource.failure_message = resourceWithStatus.failure_message;
      } else {
        delete resource.failure_message;
      }
    }
  }
}

export class UpgradePartiallyInstalledAsset extends InstallationStrategy {
  isMyTask(currentAsset: Asset, previousAssets: Asset[]) {
    this.asset = currentAsset;
    this.previousAsset = previousAssets.find(asset => asset.status == "partially_installed");

    return !!this.previousAsset;
  }

  private throwError() {
    throw Error(
      "Found another version of this asset with partially_installed status. Please reinstall or remove that version before install a new one."
    );
  }

  getChanges() {
    this.throwError();
  }

  afterInstall() {
    this.throwError();
  }
}

export class UpgradeInstalledAsset extends InstallationStrategy {
  isMyTask(currentAsset: Asset, previousAssets: Asset[]) {
    super.asset = currentAsset;
    this.previousAsset = previousAssets.find(asset => asset.status == "installed");

    return !!this.previousAsset;
  }

  getChanges() {
    const existingResources = this.previousAsset.resources.filter(
      resource => resource.installation_status == "installed"
    );
    const desiredResources = this.asset.resources;

    this.changes = compareResourceGroups<Resource<object>>(desiredResources, existingResources, {
      uniqueField: "_id",
      ignoredFields: ["installation_status", "failure_message"]
    });
    return this.changes;
  }

  afterInstall(resourcesAfterInstall: Resource[]) {
    this.updateResources(resourcesAfterInstall);

    this.previousAsset.status = "downloaded";
    this.previousAsset.resources = this.previousAsset.resources.map(r => {
      delete r.installation_status;
      delete r.failure_message;
      return r;
    });

    const isPartiallyInstalled = this.asset.resources.some(r => r.installation_status == "failed");

    this.asset.status = isPartiallyInstalled ? "partially_installed" : "installed";
    console.dir(this.previousAsset,{depth:Infinity})
    return [this.asset, this.previousAsset];
  }
}

export class InstallAsset extends InstallationStrategy {
  isMyTask(currentAsset: Asset, previousAssets: Asset[]): boolean {
    this.asset = currentAsset;
    this.previousAsset = previousAssets.find(
      asset => asset.status == "installed" || asset.status == "partially_installed"
    );

    return !this.previousAsset;
  }
  getChanges(): {
    insertions: Resource<object>[];
    updations: Resource<object>[];
    deletions: Resource<object>[];
  } {
    const existingResources = this.asset.resources.filter(
      resource => resource.installation_status == "installed"
    );
    const desiredResources = this.asset.resources;

    this.changes = compareResourceGroups<Resource<object>>(desiredResources, existingResources, {
      uniqueField: "_id",
      ignoredFields: ["installation_status", "failure_message"]
    });
    return this.changes;
  }
  afterInstall(resourcesAfterInstall: Resource[]): Asset[] {
    this.updateResources(resourcesAfterInstall);

    const isPartiallyInstalled = this.asset.resources.some(r => r.installation_status == "failed");

    this.asset.status = isPartiallyInstalled ? "partially_installed" : "installed";

    return [this.asset];
  }
}

export const installationStrategies: InstallationStrategy[] = [
  new UpgradePartiallyInstalledAsset(),
  new UpgradeInstalledAsset(),
  new InstallAsset()
];
