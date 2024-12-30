import {Component, Inject} from "@angular/core";
import {MatLegacyDialogRef as MatDialogRef} from "@angular/material/legacy-dialog";
import {getEmptyConfig} from "@spica-client/asset/helpers";
import {
  ASSET_CONFIG_EXPORTER,
  AvailableResourcesByModule,
  Config,
  ExportMeta,
  Option,
  Resource
} from "@spica-client/asset/interfaces";
import {AssetService} from "@spica-client/asset/services/asset.service";

@Component({
  selector: "asset-export",
  templateUrl: "./export.component.html",
  styleUrls: ["./export.component.scss"]
})
export class ExportComponent {
  availableResources: AvailableResourcesByModule;

  exportMeta: ExportMeta = {
    name: undefined,
    description: undefined,
    resources: {},
    configs: [],
    url: undefined
  };

  configSteps: Option[][][] = [];

  constructor(
    private assetService: AssetService,
    @Inject(ASSET_CONFIG_EXPORTER) private _configExporters: Option[],
    public dialogRef: MatDialogRef<ExportComponent>
  ) {
    this.assetService.listResources().then(r => (this.availableResources = r));
  }

  onChange(option: Option, configIndex: number, stepIndex: number) {
    this.exportMeta.configs[configIndex][option.name] = option.value;

    option.onSelect(option.value).then(options => {
      this.configSteps[configIndex][stepIndex + 1] = options;
      this.configSteps[configIndex] = this.configSteps[configIndex].slice(0, stepIndex + 2);
    });
  }

  export() {
    this.assetService
      .export(this.exportMeta)
      .toPromise()
      .then(r => {
        const blob = new Blob([r], {type: r.type});
        const downloadUrl = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = downloadUrl;
        link.click();

        this.dialogRef.close();
      });
  }

  addConfig() {
    this.exportMeta.configs.push(getEmptyConfig());
    this.configSteps.push([this._configExporters]);
  }

  removeConfig(i) {
    this.configSteps.splice(i, 1);
    this.exportMeta.configs.splice(i, 1);
  }

  selectAllResources(module: string, resources: Resource<unknown>[], from) {
    if (
      !this.exportMeta.resources[module] ||
      this.exportMeta.resources[module].length < resources.length
    ) {
      this.exportMeta.resources[module] = resources.map(r => r._id);
    } else {
      this.exportMeta.resources[module] = [];
    }
  }

  _trackBy: (i) => any = i => i;
  _trackBy2: (i) => any = i => i;

  _trackBy3: (i) => any = i => i;
  _trackBy4: (i) => any = i => i;
}
