import {ModuleWithProviders, NgModule} from "@angular/core";
import {ASSET_CONFIG_EXPORTER, ASSET_RESOURCE_LISTER} from "@spica-client/asset/interfaces";
import {PreferencesService} from "./preferences.service";
import {assetConfigExporter, listResources} from "./asset";

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
        },
        {
          provide: ASSET_RESOURCE_LISTER,
          useFactory: () => {
            return {name: "preference", list: () => listResources()};
          },
          multi: true
        }
      ]
    };
  }
}
