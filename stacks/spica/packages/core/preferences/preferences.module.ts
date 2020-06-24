import {ModuleWithProviders, NgModule} from "@angular/core";
import {PreferencesService} from "./preferences.service";

@NgModule({declarations: [], imports: []})
export class PreferencesModule {
  public static forChild(): ModuleWithProviders<PreferencesModule> {
    return {ngModule: PreferencesModule, providers: [PreferencesService]};
  }
}
