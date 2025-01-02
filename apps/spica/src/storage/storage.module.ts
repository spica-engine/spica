import {CommonModule} from "@angular/common";
import {ModuleWithProviders, NgModule} from "@angular/core";
import {FormsModule} from "@angular/forms";
import {MatButtonModule} from "@angular/material/button";
import {MatCardModule} from "@angular/material/card";
import {MatDialogModule} from "@angular/material/dialog";
import {MatFormFieldModule} from "@angular/material/form-field";
import {MatGridListModule} from "@angular/material/grid-list";
import {MatIconModule} from "@angular/material/icon";
import {MatListModule} from "@angular/material/list";
import {MatInputModule} from "@angular/material/input";
import {MatMenuModule} from "@angular/material/menu";
import {MatPaginatorModule} from "@angular/material/paginator";
import {MatProgressSpinnerModule} from "@angular/material/progress-spinner";
import {MatProgressBarModule} from "@angular/material/progress-bar";
import {MatSelectModule} from "@angular/material/select";
import {MatLegacySliderModule as MatSliderModule} from "@angular/material/legacy-slider";
import {MatLegacyTabsModule as MatTabsModule} from "@angular/material/legacy-tabs";
import {MatToolbarModule} from "@angular/material/toolbar";
import {MatLegacyTooltipModule as MatTooltipModule} from "@angular/material/legacy-tooltip";
import {InputModule} from "@spica-client/common";
import {BUILDLINK_FACTORY} from "@spica-client/core/factories/factory";
import {MatAwareDialogModule, MatClipboardModule, MatSaveModule} from "@spica-client/material";
import {provideActivityFactory} from "@spica-client/storage/providers/activity";
import {AngularCropperjsModule} from "angular-cropperjs";
import {ImageEditorComponent} from "./components/image-editor/image-editor.component";
import {PickerComponent} from "./components/picker/picker.component";
import {PickerDirective} from "./components/picker/picker.directive";
import {StorageDialogOverviewDialog} from "./components/storage-dialog-overview/storage-dialog-overview";
import {StorageViewComponent} from "./components/storage-view/storage-view.component";
import {StorageComponent} from "./components/storage/storage.component";
import {IndexComponent} from "./pages/index/index.component";
import {StorageRoutingModule} from "./storage-routing.module";
import {AddDirectoryDialog} from "./components/add-directory-dialog/add-directory-dialog.component";
import {LAYOUT_INITIALIZER, RouteService} from "@spica-client/core";
import {StorageInitializer} from "./storage.initializer";
import {PassportModule, PassportService} from "@spica-client/passport";
import {MatCheckboxModule} from "@angular/material/checkbox";
import {RootDirService} from "./services/root.dir.service";
import {DragDropModule} from "@angular/cdk/drag-drop";
import {WelcomeComponent} from "./pages/welcome/welcome.component";
import {ImageViewerComponent} from "./components/image-viewer/image-viewer.component";
import {DefaultViewerComponent} from "./components/default-viewer/default-viewer.component";
import {VideoViewerComponent} from "./components/video-viewer/video-viewer.component";
import {TextViewerComponent} from "./components/text-viewer/text-viewer.component";
import {PdfViewerComponent} from "./components/pdf-viewer/pdf-viewer.component";
import {ZipViewerComponent} from "./components/zip-viewer/zip-viewer.component";
import {TableViewerComponent} from "./components/table-viewer/table-viewer.component";
import {MatLegacyTableModule as MatTableModule} from "@angular/material/legacy-table";

@NgModule({
  imports: [
    MatTableModule,
    CommonModule,
    FormsModule,
    MatAwareDialogModule,
    MatTabsModule,
    MatTooltipModule,
    MatDialogModule,
    MatProgressSpinnerModule,
    MatPaginatorModule,
    MatButtonModule,
    MatIconModule,
    MatGridListModule,
    MatProgressBarModule,
    MatCardModule,
    StorageRoutingModule,
    MatFormFieldModule,
    MatSelectModule,
    MatSliderModule,
    MatInputModule,
    AngularCropperjsModule,
    MatToolbarModule,
    MatClipboardModule,
    MatMenuModule,
    MatSaveModule,
    MatListModule,
    MatCheckboxModule,
    DragDropModule,
    InputModule.withPlacers([
      {
        origin: "string",
        type: "storage",
        icon: "perm_media",
        color: "#ab1ada",
        placer: StorageComponent
      }
    ]),
    PassportModule.forChild()
  ],
  declarations: [
    IndexComponent,
    PickerComponent,
    StorageDialogOverviewDialog,
    PickerDirective,
    StorageComponent,
    StorageViewComponent,
    ImageEditorComponent,
    AddDirectoryDialog,
    WelcomeComponent,
    ImageViewerComponent,
    DefaultViewerComponent,
    VideoViewerComponent,
    TextViewerComponent,
    PdfViewerComponent,
    ZipViewerComponent,
    TableViewerComponent
  ],
  exports: [PickerDirective]
})
export class StorageModule {
  static forRoot(): ModuleWithProviders<StorageModule> {
    return {
      ngModule: StorageModule,
      providers: [
        {
          provide: BUILDLINK_FACTORY,
          useValue: {caller: "activity", factory: provideActivityFactory},
          multi: true
        },
        {
          provide: StorageInitializer,
          useClass: StorageInitializer,
          deps: [RootDirService, RouteService, PassportService]
        },
        {
          provide: LAYOUT_INITIALIZER,
          useFactory: provideStorageLoader,
          multi: true,
          deps: [StorageInitializer]
        }
      ]
    };
  }

  static forChild(): ModuleWithProviders<StorageModule> {
    return {ngModule: StorageModule, providers: []};
  }
}

export function provideStorageLoader(l: StorageInitializer) {
  return l.appInitializer.bind(l);
}
