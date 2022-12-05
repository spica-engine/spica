import {Component, Inject} from "@angular/core";
import {MatDialogRef, MAT_DIALOG_DATA} from "@angular/material/dialog";
import {DomSanitizer, SafeResourceUrl} from "@angular/platform-browser";
import {Asset, Resource} from "@spica-client/asset/interfaces";
import {AssetService} from "@spica-client/asset/services/asset.service";

@Component({
  selector: "asset-install-dialog",
  templateUrl: "./install.component.html",
  styleUrls: ["./install.component.scss"]
})
export class AssetInstallDialog {
  step = 0;

  installationPreview: {
    [module: string]: {
      insertions: object[];
      updations: object[];
      deletions: object[];
    };
  } = {};

  constructor(@Inject(MAT_DIALOG_DATA) public data: any, private assetService: AssetService,public dialogRef: MatDialogRef<any>) {}

  preview() {
    this.step = 1;
    return this.assetService
      .install(this.data.asset._id, this.data.asset.configs, true)
      .toPromise()
      .then((preview: any) => {
        this.formatInstallationPreview(preview);
      });
  }

  configure() {
    this.step = 0;
    this.installationPreview = {};
  }

  install(asset:Asset) {
    return this.dialogRef.close(asset)
  }

  getEmptyPreview() {
    return {
      insertions: [],
      updations: [],
      deletions: []
    };
  }

  formatInstallationPreview(preview: {
    insertions: Resource[];
    updations: Resource[];
    deletions: Resource[];
  }) {
    const pushToPreview = (
      resource: Resource,
      action: "insertions" | "updations" | "deletions"
    ) => {
      this.installationPreview[resource.module] =
        this.installationPreview[resource.module] || this.getEmptyPreview();
      this.installationPreview[resource.module][action].push(resource);
    };

    preview.insertions.forEach(resource => pushToPreview(resource, "insertions"));
    preview.updations.forEach(resource => pushToPreview(resource, "updations"));
    preview.deletions.forEach(resource => pushToPreview(resource, "deletions"));
  }

  displayPreview(actions: any[]) {
    const data = JSON.stringify(actions, null, 2);
    const x = window.open();
    x.document.open();
    x.document.write("<html><body><pre>" + data + "</pre></body></html>");
    x.document.close();
  }
}
