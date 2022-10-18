import {NgModule} from "@angular/core";
import {AddComponent} from "./pages/add/add.component";
import {IndexComponent} from "./pages/index/index.component";
import {AssetComponent} from "./pages/asset/asset.component";
import {AssetRoutingModule} from "./asset-routing.module";
import {AssetService} from "./services/asset.service";
import {AssetInitializer} from "./asset.initializer";
import {LAYOUT_INITIALIZER, RouteService} from "@spica-client/core";
import {PassportService} from "@spica-client/passport";
import {CommonModule} from "@angular/common";
import {MatCardModule} from "@angular/material/card";
import {MatIconModule} from "@angular/material/icon";
import {MatToolbarModule} from "@angular/material/toolbar";
import {MatExpansionModule} from "@angular/material/expansion";
import {MatTableModule} from '@angular/material/table';

@NgModule({
  imports: [
    AssetRoutingModule,
    CommonModule,
    MatCardModule,
    MatIconModule,
    MatToolbarModule,
    MatExpansionModule,
    MatTableModule
  ],
  declarations: [AddComponent, IndexComponent, AssetComponent],
  providers: [
    AssetService,
    {
      provide: AssetInitializer,
      useClass: AssetInitializer,
      deps: [AssetService, RouteService, PassportService]
    },
    {
      provide: LAYOUT_INITIALIZER,
      useFactory: provideAssetLoader,
      multi: true,
      deps: [AssetInitializer]
    }
  ]
})
export class AssetModule {}

export function provideAssetLoader(l: AssetInitializer) {
  return l.appInitializer.bind(l);
}
