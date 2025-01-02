import {NgModule} from "@angular/core";
import {CommonModule} from "@angular/common";
import {AssetRoutingModule} from "./asset-routing.module";
import {IndexComponent} from "./pages/index/index.component";
import {MatToolbarModule} from "@angular/material/toolbar";
import {FormsModule} from "@angular/forms";
import {MatButtonModule} from "@angular/material/button";
import {MatCardModule} from "@angular/material/card";
import {MatDividerModule} from "@angular/material/divider";
import {MatFormFieldModule} from "@angular/material/form-field";
import {MatIconModule} from "@angular/material/icon";
import {MatListModule} from "@angular/material/list";
import {MatInputModule} from "@angular/material/input";
import {MatMenuModule} from "@angular/material/menu";
import {MatPaginatorModule} from "@angular/material/paginator";
import {MatLegacyProgressSpinnerModule as MatProgressSpinnerModule} from "@angular/material/legacy-progress-spinner";
import {MatSelectModule} from "@angular/material/select";
import {MatSortModule} from "@angular/material/sort";
import {MatLegacyTableModule as MatTableModule} from "@angular/material/legacy-table";
import {MatLegacyTooltipModule as MatTooltipModule} from "@angular/material/legacy-tooltip";
import {BrowserModule} from "@angular/platform-browser";
import {StoreModule} from "@ngrx/store";
import {InputModule} from "@spica-client/common";
import {DashboardRoutingModule} from "@spica-client/dashboard/dashboard-routing.module";
import {MatAwareDialogModule, MatSaveModule} from "@spica-client/material";
import {PassportModule, PassportService} from "@spica-client/passport";
import * as fromAsset from "./state/asset.reducer";
import {AssetService} from "./services/asset.service";
import {LAYOUT_INITIALIZER, RouteService} from "@spica-client/core";
import {AssetInitializer} from "./services/asset.initializer";
import {AssetInstallDialog} from "./components/install/install.component";
import {EditComponent} from "./pages/edit/edit.component";
import {MatTreeModule} from "@angular/material/tree";
import {CommonModule as SpicaCommon} from "@spica/client/packages/common";
import {PreviewComponent} from "./components/preview/preview.component";
import {AssetStoreComponent} from "./pages/asset-store/asset-store.component";
import {ExportComponent} from "./components/export/export.component";
import {MatDialogModule} from "@angular/material/dialog";
import {MatSlideToggleModule} from "@angular/material/slide-toggle";
import {MatCheckboxModule} from "@angular/material/checkbox";
import {ResourcesComponent} from "./components/resources/resources.component";
import {MatRippleModule} from "@angular/material/core";

@NgModule({
  imports: [
    SpicaCommon,
    MatTreeModule,
    CommonModule,
    MatCardModule,
    MatListModule,
    MatMenuModule,
    DashboardRoutingModule,
    MatToolbarModule,
    MatIconModule,
    MatPaginatorModule,
    MatFormFieldModule,
    MatInputModule,
    BrowserModule,
    MatButtonModule,
    MatTooltipModule,
    MatSortModule,
    StoreModule.forFeature("asset", fromAsset.reducer),
    InputModule,
    FormsModule,
    MatSlideToggleModule,
    MatCheckboxModule,
    MatTableModule,
    MatAwareDialogModule,
    PassportModule.forChild(),
    MatProgressSpinnerModule,
    MatDividerModule,
    AssetRoutingModule,
    MatAwareDialogModule,
    MatSaveModule,
    MatDialogModule,
    MatSelectModule,
    CommonModule,
    MatRippleModule
  ],
  declarations: [
    IndexComponent,
    AssetInstallDialog,
    EditComponent,
    PreviewComponent,
    AssetStoreComponent,
    ExportComponent,
    ResourcesComponent
  ],
  providers: [
    AssetService,
    {
      provide: AssetInitializer,
      useClass: AssetInitializer,
      deps: [AssetService, RouteService, PassportService]
    },
    {
      provide: LAYOUT_INITIALIZER,
      useFactory: provideAssetInitializer,
      multi: true,
      deps: [AssetInitializer]
    }
  ]
})
export class AssetModule {}

export function provideAssetInitializer(l: AssetInitializer) {
  return l.appInitializer.bind(l);
}
