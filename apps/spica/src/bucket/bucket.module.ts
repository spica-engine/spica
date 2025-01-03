import {DragDropModule} from "@angular/cdk/drag-drop";
import {CommonModule} from "@angular/common";
import {ModuleWithProviders, NgModule} from "@angular/core";
import {FormsModule} from "@angular/forms";
import {MatBadgeModule} from "@angular/material/badge";
import {MatButtonModule} from "@angular/material/button";
import {MatCheckboxModule} from "@angular/material/checkbox";
import {MatChipsModule} from "@angular/material/chips";
import {MatCardModule} from "@angular/material/card";
import {MatRippleModule} from "@angular/material/core";
import {MatDatepickerModule} from "@angular/material/datepicker";
import {MatDividerModule} from "@angular/material/divider";
import {MatExpansionModule} from "@angular/material/expansion";
import {MatGridListModule} from "@angular/material/grid-list";
import {MatIconModule} from "@angular/material/icon";
import {MatListModule} from "@angular/material/list";
import {MatInputModule} from "@angular/material/input";
import {MatMenuModule} from "@angular/material/menu";
import {MatPaginatorModule} from "@angular/material/paginator";
import {MatRadioModule} from "@angular/material/radio";
import {MatProgressSpinnerModule} from "@angular/material/progress-spinner";
import {MatProgressBarModule} from "@angular/material/progress-bar";
import {MatSelectModule} from "@angular/material/select";
import {MatSliderModule} from "@angular/material/slider";
import {MatSlideToggleModule} from "@angular/material/slide-toggle";
import {MatSortModule} from "@angular/material/sort";
import {MatStepperModule} from "@angular/material/stepper";
import {MatLegacyTableModule as MatTableModule} from "@angular/material/legacy-table";
import {MatLegacyTabsModule as MatTabsModule} from "@angular/material/legacy-tabs";
import {MatToolbarModule} from "@angular/material/toolbar";
import {MatLegacyTooltipModule as MatTooltipModule} from "@angular/material/legacy-tooltip";
import {LeafletModule} from "@asymmetrik/ngx-leaflet";
import {OwlDateTimeModule, OwlNativeDateTimeModule} from "@danielmoncada/angular-datetime-picker";
import {StoreModule} from "@ngrx/store";
import {provideActivityFactory, provideAssetFactory} from "@spica-client/bucket/providers";
import {CommonModule as SpicaCommon, InputModule} from "@spica-client/common";
import {EditorModule} from "@spica-client/common/code-editor";
import {LAYOUT_INITIALIZER, PreferencesModule, RouteService} from "@spica-client/core";
import {BUILDLINK_FACTORY} from "@spica-client/core/factories/factory";
import {MatAwareDialogModule, MatClipboardModule, MatSaveModule} from "@spica-client/material";
import {MatResizeHeaderModule} from "@spica-client/material/resize";
import {PassportModule, PassportService} from "../passport";
import {StorageModule} from "../storage";
import {BucketRoutingModule} from "./bucket-routing.module";
import {CelLanguageDirective} from "./components/cel-editor/cel.language";
import {JsonLanguageDirective} from "./components/json-editor/json.language";
import {FilterComponent} from "./components/filter/filter.component";
import {PropertyLanguageComponent} from "./components/language/language.component";
import {createLocation, LocationComponent} from "./components/location/location.component";
import {RelationSchemaComponent} from "./components/relation-schema/relation-schema.component";
import {RelationComponent} from "./components/relation/relation.component";
import {RichTextEditorComponent} from "./components/richtext/richtext";
import {AddFieldModalComponent} from "./pages/add-field-modal/add-field-modal.component";
import {AddComponent} from "./pages/add/add.component";
import {AddBucketComponent} from "./components/add-bucket/add-bucket.component";
import {BucketActionsComponent} from "./pages/bucket-actions/bucket-actions.component";
import {IndexComponent} from "./pages/index/index.component";
import {SettingsComponent} from "./pages/settings/settings.component";
import {WelcomeComponent} from "./pages/welcome/welcome.component";
import {BucketDataService} from "./services/bucket-data.service";
import {BucketHistoryService} from "./services/bucket-history.service";
import {BucketInitializer} from "./services/bucket.initializer";
import {BucketService} from "./services/bucket.service";
import * as fromBucket from "./state/bucket.reducer";
import {RequiredTranslate} from "./validators";
import {MatButtonToggleModule} from "@angular/material/button-toggle";
import {HighlightModule, HIGHLIGHT_OPTIONS} from "ngx-highlightjs";
import {BucketOptions, BUCKET_OPTIONS} from "./interfaces/bucket";
import {IGNORE_HTTP_ERRORS} from "@spica-client/core/layout/config";
import {SettingsBucketComponent} from "./components/settings-bucket/settings-bucket.component";
import {PropertyMenuComponent} from "./components/property-menu/property-menu.component";
import {ASSET_CONFIG_EXPORTER, ASSET_RESOURCE_LISTER} from "@spica-client/asset/interfaces";
import {assetConfigExporter, listResources} from "./asset";

@NgModule({
  imports: [
    InputModule.withPlacers([
      {
        origin: "string",
        type: "relation",
        icon: "call_merge",
        color: "#d71ada",
        placer: RelationComponent,
        metaPlacer: RelationSchemaComponent
      },
      {
        origin: "string",
        type: "richtext",
        icon: "format_align_center",
        color: "#da1a4f",
        placer: RichTextEditorComponent
      },
      {
        origin: "object",
        type: "location",
        icon: "location_on",
        color: "#da7b1a",
        placer: LocationComponent,
        coerce: createLocation
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
    MatResizeHeaderModule,
    MatRippleModule,
    MatAwareDialogModule,
    MatGridListModule,
    MatExpansionModule,
    MatButtonToggleModule,
    MatChipsModule,
    MatToolbarModule,
    MatRadioModule,
    MatProgressBarModule,
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
    MatSaveModule,
    PassportModule.forChild(),
    SpicaCommon,
    EditorModule,
    HighlightModule
  ],
  declarations: [
    IndexComponent,
    AddComponent,
    BucketActionsComponent,
    AddBucketComponent,
    WelcomeComponent,
    RichTextEditorComponent,
    RelationComponent,
    RelationSchemaComponent,
    LocationComponent,
    SettingsComponent,
    FilterComponent,
    RequiredTranslate,
    AddFieldModalComponent,
    PropertyLanguageComponent,
    CelLanguageDirective,
    JsonLanguageDirective,
    PropertyLanguageComponent,
    SettingsBucketComponent,
    PropertyMenuComponent
  ]
})
export class BucketModule {
  public static forRoot(options: BucketOptions): ModuleWithProviders<BucketModule> {
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
        },
        {
          provide: BUILDLINK_FACTORY,
          useValue: {caller: "activity", factory: provideActivityFactory},
          multi: true
        },
        {
          provide: BUILDLINK_FACTORY,
          useValue: {caller: "asset", factory: provideAssetFactory},
          multi: true
        },
        {
          provide: BUCKET_OPTIONS,
          useValue: options
        },
        {
          provide: HIGHLIGHT_OPTIONS,
          useValue: {
            coreLibraryLoader: () => import("highlight.js/lib/core"),
            lineNumbersLoader: () => import("highlightjs-line-numbers.js"),
            languages: {
              typescript: () => import("highlight.js/lib/languages/typescript"),
              json: () => import("highlight.js/lib/languages/json")
            }
          }
        },
        {
          provide: IGNORE_HTTP_ERRORS,
          useValue: (url: string, code: number) => {
            if (
              url.endsWith("000000000000000000000000/history/000000000000000000000000") &&
              code == 404
            ) {
              return true;
            }
            return false;
          },
          multi: true
        },
        {
          provide: ASSET_CONFIG_EXPORTER,
          useFactory: assetConfigExporter,
          deps: [BucketService],
          multi: true
        },
        {
          provide: ASSET_RESOURCE_LISTER,
          useFactory: bs => {
            return {name: "bucket", list: () => listResources(bs)};
          },
          deps: [BucketService],
          multi: true
        }
      ]
    };
  }

  public static forChild(): ModuleWithProviders<BucketModule> {
    return {
      ngModule: BucketModule,
      providers: [BucketService, BucketDataService]
    };
  }
}

export function provideBucketLoader(l: BucketInitializer) {
  return l.appInitializer.bind(l);
}
