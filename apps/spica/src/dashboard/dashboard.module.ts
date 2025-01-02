import {CommonModule} from "@angular/common";
import {NgModule} from "@angular/core";
import {FormsModule} from "@angular/forms";
import {MatButtonModule} from "@angular/material/button";
import {MatLegacyFormFieldModule as MatFormFieldModule} from "@angular/material/legacy-form-field";
import {MatLegacyInputModule as MatInputModule} from "@angular/material/legacy-input";
import {MatPaginatorModule} from "@angular/material/paginator";
import {MatSortModule} from "@angular/material/sort";
import {MatToolbarModule} from "@angular/material/toolbar";
import {MatLegacyTooltipModule as MatTooltipModule} from "@angular/material/legacy-tooltip";
import {MatCardModule} from "@angular/material/card";
import {MatIconModule} from "@angular/material/icon";
import {MatListModule} from "@angular/material/list";
import {BrowserModule} from "@angular/platform-browser";
import {StoreModule} from "@ngrx/store";
import {InputModule} from "@spica-client/common";
import {BUILDLINK_FACTORY, LAYOUT_INITIALIZER, RouteService} from "@spica-client/core";
import {ChartsModule} from "ng2-charts";
import {PassportService, PassportModule} from "../passport";
import {DashboardRoutingModule} from "./dashboard-routing.module";
import {DashboardViewComponent} from "./pages/dashboard-view/dashboard-view.component";
import {DashboardComponent} from "./pages/dashboard/dashboard.component";
import {DashboardInitializer} from "./services/dashboard.initializer";
import {DashboardService} from "./services/dashboard.service";
import {VersionControlService} from "./services/versioncontrol.service";
import * as fromDashboard from "./state/dashboard.reducer";
import {TutorialComponent} from "./pages/tutorial/tutorial.component";
import {MatStepperModule} from "@angular/material/stepper";
import {MatLegacySelectModule as MatSelectModule} from "@angular/material/legacy-select";
import {MatLegacyTabsModule as MatTabsModule} from "@angular/material/legacy-tabs";
import {MatLegacyTableModule as MatTableModule} from "@angular/material/legacy-table";
import {MatClipboardModule, MatAwareDialogModule} from "@spica-client/material";
import {AddComponent} from "./pages/add/add.component";
import {IndexComponent} from "./pages/index/index.component";
import {MatLegacyMenuModule as MatMenuModule} from "@angular/material/legacy-menu";
import {CommonModule as SpicaCommon} from "@spica-client/common";
import {DefaultComponent} from "./components/default/default.component";
import {TableComponent} from "./components/table/table.component";
import {OwlDateTimeModule, OwlNativeDateTimeModule} from "@danielmoncada/angular-datetime-picker";
import {WelcomeComponent} from "./pages/welcome/welcome.component";
import {CardComponent} from "./components/card/card.component";
import {DashboardLayout} from "./components/layout/layout.component";
import {DragDropModule} from "@angular/cdk/drag-drop";
import {MatLegacyProgressSpinnerModule as MatProgressSpinnerModule} from "@angular/material/legacy-progress-spinner";
import {MatLegacyProgressBarModule as MatProgressBarModule} from "@angular/material/legacy-progress-bar";
import {MatDividerModule} from "@angular/material/divider";
import {StatisticComponent} from "./components/statistic/statistic.component";
import {VersionControlComponent} from "./pages/versioncontrol/versioncontrol.component";
import {MatExpansionModule} from "@angular/material/expansion";
import {provideAssetFactory, provideAssetConfigExporter, listResources} from "./providers/asset";
import {ASSET_CONFIG_EXPORTER, ASSET_RESOURCE_LISTER} from "@spica-client/asset/interfaces";
import {MuuriModule} from "muuri-angular";

@NgModule({
  imports: [
    SpicaCommon,
    CommonModule,
    MatCardModule,
    MatListModule,
    MatMenuModule,
    DashboardRoutingModule,
    MatToolbarModule,
    MatIconModule,
    ChartsModule,
    MatPaginatorModule,
    MatFormFieldModule,
    MatInputModule,
    BrowserModule,
    MatButtonModule,
    MatTooltipModule,
    MatSortModule,
    StoreModule.forFeature("dashboard", fromDashboard.reducer),
    InputModule,
    FormsModule,
    MatStepperModule,
    MatSelectModule,
    MatTabsModule,
    MatTableModule,
    MatClipboardModule,
    OwlDateTimeModule,
    OwlNativeDateTimeModule,
    MatAwareDialogModule,
    PassportModule.forChild(),
    DragDropModule,
    MatProgressSpinnerModule,
    MatProgressBarModule,
    MatDividerModule,
    MatExpansionModule,
    MuuriModule
  ],
  declarations: [
    DashboardComponent,
    DashboardViewComponent,
    TutorialComponent,
    AddComponent,
    IndexComponent,
    DefaultComponent,
    TableComponent,
    WelcomeComponent,
    CardComponent,
    StatisticComponent,
    VersionControlComponent,
    DashboardLayout
  ],
  providers: [
    VersionControlService,
    DashboardService,
    {
      provide: DashboardInitializer,
      useClass: DashboardInitializer,
      deps: [DashboardService, RouteService, PassportService]
    },
    {
      provide: LAYOUT_INITIALIZER,
      useFactory: provideDashboardLoader,
      multi: true,
      deps: [DashboardInitializer]
    },
    {
      provide: BUILDLINK_FACTORY,
      useValue: {caller: "asset", factory: provideAssetFactory},
      multi: true
    },
    {
      provide: ASSET_CONFIG_EXPORTER,
      useFactory: provideAssetConfigExporter,
      deps: [DashboardService],
      multi: true
    },
    {
      provide: ASSET_RESOURCE_LISTER,
      useFactory: ds => {
        return {name: "dashboard", list: () => listResources(ds)};
      },
      deps: [DashboardService],
      multi: true
    }
  ]
})
export class DashboardModule {}

export function provideDashboardLoader(l: DashboardInitializer) {
  return l.appInitializer.bind(l);
}
