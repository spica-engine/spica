import {Component, Inject} from "@angular/core";
import {MAT_DIALOG_DATA} from "@angular/material/dialog";
import {DomSanitizer, SafeResourceUrl} from "@angular/platform-browser";
import {Asset} from "@spica-client/asset/interfaces";
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

  constructor(@Inject(MAT_DIALOG_DATA) public data: any, private assetService: AssetService) {}

  preview() {
    this.step = 1;
    return this.assetService
      .install(this.data.asset._id, this.data.asset.configs, true)
      .toPromise()
      .then((r: any) => {
        r.installations.forEach(i => {
          this.installationPreview[i.module] = this.installationPreview[i.module] || {
            insertions: [],
            updations: [],
            deletions: []
          };

          this.installationPreview[i.module].insertions.push(i);
        });

        r.updations.forEach(i => {
          this.installationPreview[i.module] = this.installationPreview[i.module] || {
            insertions: [],
            updations: [],
            deletions: []
          };

          this.installationPreview[i.module].updations.push(i);
        });

        r.deletions.forEach(i => {
          this.installationPreview[i.module] = this.installationPreview[i.module] || {
            insertions: [],
            updations: [],
            deletions: []
          };

          this.installationPreview[i.module].deletions.push(i);
        });
      });
  }

  configure() {
    this.step = 0;
    this.installationPreview = {};
  }

  install() {
    console.log("NOT IMPLEMENTED YET!");
  }
}
