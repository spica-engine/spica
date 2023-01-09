import {ModuleWithProviders, NgModule} from "@angular/core";
import {ASSET_CONFIG_EXPORTER} from "@spica-client/asset/interfaces";
import {PreferencesService} from "./preferences.service";
import {assetConfigExporter} from "./asset";

@NgModule({declarations: [], imports: []})
export class PreferencesModule {
  public static forChild(): ModuleWithProviders<PreferencesModule> {
    return {
      ngModule: PreferencesModule,
      providers: [PreferencesService]
    };
  }

  public static forRoot(): ModuleWithProviders<PreferencesModule> {
    return {
      ngModule: PreferencesModule,
      providers: [
        PreferencesService,
        {
          provide: ASSET_CONFIG_EXPORTER,
          useFactory: assetConfigExporter,
          deps: [PreferencesService],
          multi: true
        }
      ]
    };
  }
}
