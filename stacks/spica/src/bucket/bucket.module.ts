import {DragDropModule} from "@angular/cdk/drag-drop";
import {CommonModule} from "@angular/common";
import {ModuleWithProviders, NgModule} from "@angular/core";
import {FormsModule} from "@angular/forms";
import {MatBadgeModule} from "@angular/material/badge";
import {MatButtonModule} from "@angular/material/button";
import {MatCardModule} from "@angular/material/card";
import {MatCheckboxModule} from "@angular/material/checkbox";
import {MatRippleModule} from "@angular/material/core";
import {MatDividerModule} from "@angular/material/divider";
import {MatExpansionModule} from "@angular/material/expansion";
import {MatGridListModule} from "@angular/material/grid-list";
import {MatIconModule} from "@angular/material/icon";
import {MatInputModule} from "@angular/material/input";
import {MatListModule} from "@angular/material/list";
import {MatMenuModule} from "@angular/material/menu";
import {MatPaginatorModule} from "@angular/material/paginator";
import {MatProgressSpinnerModule} from "@angular/material/progress-spinner";
import {MatRadioModule} from "@angular/material/radio";
import {MatSelectModule} from "@angular/material/select";
import {MatSlideToggleModule} from "@angular/material/slide-toggle";
import {MatSliderModule} from "@angular/material/slider";
import {MatSortModule} from "@angular/material/sort";
import {MatStepperModule} from "@angular/material/stepper";
import {MatTableModule} from "@angular/material/table";
import {MatTabsModule} from "@angular/material/tabs";
import {MatToolbarModule} from "@angular/material/toolbar";
import {MatTooltipModule} from "@angular/material/tooltip";
import {LeafletModule} from "@asymmetrik/ngx-leaflet";
import {StoreModule} from "@ngrx/store";
import {InputModule} from "@spica-client/common";
import {LAYOUT_INITIALIZER, PreferencesModule, RouteService} from "@spica-client/core";
import {MatAwareDialogModule, MatClipboardModule} from "@spica-client/material";
import {PassportModule, PassportService} from "../passport";
import {StorageModule} from "../storage";
import {BucketRoutingModule} from "./bucket-routing.module";
import {FilterComponent} from "./components/filter/filter.component";
import {PropertyLanguageComponent} from "./components/language/language.component";
import {LocationComponent} from "./components/location/location.component";
import {RelationSchemaComponent} from "./components/relation-schema/relation-schema.component";
import {RelationComponent} from "./components/relation/relation.component";
import {RichTextEditorComponent} from "./components/richtext/richtext";
import {TextEditorModule} from "./components/richtext/text-editor/text-editor.module";
import {AddComponent} from "./pages/add/add.component";
import {BucketAddComponent} from "./pages/bucket-add/bucket-add.component";
import {BucketIndexComponent} from "./pages/bucket-index/bucket-index.component";
import {ImportExportComponent} from "./pages/import-export/import-export.component";
import {IndexComponent} from "./pages/index/index.component";
import {SettingsComponent} from "./pages/settings/settings.component";
import {BucketDataService} from "./services/bucket-data.service";
import {BucketHistoryService} from "./services/bucket-history.service";
import {BucketInitializer} from "./services/bucket.initializer";
import * as fromBucket from "./services/bucket.reducer";
import {BucketService} from "./services/bucket.service";
import {CommonModule as SpicaCommon} from "@spica-client/common";
import {MatDatepickerModule} from "@angular/material/datepicker";
import {OwlDateTimeModule, OwlNativeDateTimeModule} from "ng-pick-datetime";
import {MatChipsModule} from "@angular/material/chips";
import {RequiredTranslate} from "./validators";
@NgModule({
  imports: [
    InputModule.withPlacers([
      {
        origin: "string",
        type: "relation",
        placer: RelationComponent,
        metaPlacer: RelationSchemaComponent
      },
      {
        origin: "string",
        type: "richtext",
        placer: RichTextEditorComponent
      },
      {
        origin: "object",
        type: "location",
        placer: LocationComponent
      }
    ]),
    CommonModule,
    FormsModule,
    BucketRoutingModule,
    StoreModule.forFeature("bucket", fromBucket.reducer),
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatStepperModule,
    MatMenuModule,
    MatDividerModule,
    MatCheckboxModule,
    MatPaginatorModule,
    MatSelectModule,
    MatTooltipModule,
    MatTableModule,
    MatTabsModule,
    MatSliderModule,
    MatProgressSpinnerModule,
    MatListModule,
    MatSortModule,
    MatRippleModule,
    MatAwareDialogModule,
    MatGridListModule,
    MatExpansionModule,
    MatChipsModule,
    MatToolbarModule,
    MatRadioModule,
    MatBadgeModule,
    MatSlideToggleModule,
    MatDatepickerModule,
    OwlDateTimeModule,
    OwlNativeDateTimeModule,
    LeafletModule,
    DragDropModule,
    StorageModule.forChild(),
    PreferencesModule.forChild(),
    MatClipboardModule,
    TextEditorModule,
    PassportModule.forChild(),
    SpicaCommon
  ],
  declarations: [
    IndexComponent,
    AddComponent,
    BucketIndexComponent,
    BucketAddComponent,
    ImportExportComponent,

    RichTextEditorComponent,
    RelationComponent,
    RelationSchemaComponent,
    LocationComponent,

    PropertyLanguageComponent,
    SettingsComponent,
    FilterComponent,
    RequiredTranslate
  ]
})
export class BucketModule {
  public static forRoot(): ModuleWithProviders {
    return {
      ngModule: BucketModule,
      providers: [
        BucketDataService,
        BucketService,
        BucketHistoryService,
        {
          provide: BucketInitializer,
          useClass: BucketInitializer,
          deps: [BucketService, RouteService, PassportService]
        },
        {
          provide: LAYOUT_INITIALIZER,
          useFactory: provideBucketLoader,
          multi: true,
          deps: [BucketInitializer]
        }
      ]
    };
  }

  public static forChild(): ModuleWithProviders {
    return {
      ngModule: BucketModule,
      providers: [BucketService, BucketDataService]
    };
  }
}

export function provideBucketLoader(l: BucketInitializer) {
  return l.appInitializer.bind(l);
}
