import {Component, OnInit} from "@angular/core";
import {
  getConfigSchema,
  getEmptyConfig,
  getEmptyExportResources,
  getExportResourceSchema,
} from "@spica-client/asset/helpers";
import {ExportMeta} from "@spica-client/asset/interfaces";
import {AssetService} from "@spica-client/asset/services/asset.service";

@Component({
  selector: "asset-export",
  templateUrl: "./export.component.html",
  styleUrls: ["./export.component.scss"]
})
export class ExportComponent implements OnInit {
  configSchema = getConfigSchema();
  exportResources = getExportResourceSchema();

  exportMeta: ExportMeta = {
    name: undefined,
    description: undefined,
    resources: getEmptyExportResources(),
    configs: []
  };

  constructor(private assetService: AssetService) {}

  ngOnInit(): void {}

  export() {
    this.assetService.export(this.exportMeta).toPromise().then(r => {
      const blob = new Blob([r],{type:r.type})
      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.click();
    })
  }

  addConfig() {
    this.exportMeta.configs.push(getEmptyConfig());
  }

  removeConfig(i) {
    this.exportMeta.configs.splice(i, 1);
  }

  _trackBy: (i) => any = i => i;
  _trackBy2: (i) => any = i => i;

  _trackBy3: (i) => any = i => i;
  _trackBy4: (i) => any = i => i;
}
