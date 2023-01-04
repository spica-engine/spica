import {Component, Inject, OnInit} from "@angular/core";
import {getEmptyConfig} from "@spica-client/asset/helpers";
import {
  ASSET_CONFIG_EXPORTER,
  Config,
  CurrentResources,
  ExportMeta,
  Selectable
} from "@spica-client/asset/interfaces";
import {AssetService} from "@spica-client/asset/services/asset.service";

@Component({
  selector: "asset-export",
  templateUrl: "./export.component.html",
  styleUrls: ["./export.component.scss"]
})
export class ExportComponent implements OnInit {
  resources: CurrentResources = {};

  exportMeta: ExportMeta = {
    name: undefined,
    description: undefined,
    resources: {},
    configs: [],
    url: undefined
  };

  configSteps: Selectable[][][] = [];

  currentConfigs: Config[] = [];

  constructor(
    private assetService: AssetService,
    @Inject(ASSET_CONFIG_EXPORTER) private _configExporters: Selectable[]
  ) {}

  ngOnInit(): void {

  }

  onChange(selectable: Selectable, configIndex: number, stepIndex: number) {
    this.currentConfigs[configIndex][selectable.name] = selectable.value;

    selectable.onSelect(selectable.value).then(selectables => {
      this.configSteps[configIndex][stepIndex + 1] = selectables;
      this.configSteps[configIndex] = this.configSteps[configIndex].slice(0, stepIndex + 2);
      
      // if(selectables.some(s => s.isLast)){

      // }

      
    });
  }

  export() {
    // this.assetService
    //   .export(this.exportMeta)
    //   .toPromise()
    //   .then(r => {
    //     const blob = new Blob([r], {type: r.type});
    //     const downloadUrl = URL.createObjectURL(blob);
    //     const link = document.createElement("a");
    //     link.href = downloadUrl;
    //     link.click();
    //   });
  }

  addConfig() {
    this.currentConfigs.push(getEmptyConfig());
    this.configSteps.push([this._configExporters]);
    // this.exportMeta.configs.push();
  }

  removeConfig(i) {
    console.log(i);
    this.currentConfigs.splice(i, 1);
    this.configSteps.splice(i, 1);
    // this.exportMeta.configs.splice(i, 1);
  }

  _trackBy: (i) => any = i => i;
  _trackBy2: (i) => any = i => i;

  _trackBy3: (i) => any = i => i;
  _trackBy4: (i) => any = i => i;
}
