import {CommonModule} from "@angular/common";
import {ModuleWithProviders} from "@angular/compiler/src/core";
import {NgModule} from "@angular/core";
import {FormsModule} from "@angular/forms";
import {MatButtonModule} from "@angular/material/button";
import {MatCardModule} from "@angular/material/card";
import {MatDialogModule} from "@angular/material/dialog";
import {MatFormFieldModule} from "@angular/material/form-field";
import {MatGridListModule} from "@angular/material/grid-list";
import {MatIconModule} from "@angular/material/icon";
import {MatInputModule} from "@angular/material/input";
import {MatListModule} from "@angular/material/list";
import {MatMenuModule} from "@angular/material/menu";
import {MatPaginatorModule} from "@angular/material/paginator";
import {MatProgressBarModule} from "@angular/material/progress-bar";
import {MatProgressSpinnerModule} from "@angular/material/progress-spinner";
import {MatSelectModule} from "@angular/material/select";
import {MatSliderModule} from "@angular/material/slider";
import {MatTabsModule} from "@angular/material/tabs";
import {MatToolbarModule} from "@angular/material/toolbar";
import {MatTooltipModule} from "@angular/material/tooltip";
import {InputModule} from "@spica-client/common";
import {ACTIVITY_FACTORY} from "@spica-client/core/factories/factory";
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
import {AddFolderDialogComponent} from "./components/add-folder-dialog/add-folder-dialog.component";
import {LAYOUT_INITIALIZER, RouteService} from "@spica-client/core";
import {StorageService} from "./storage.service";
import {StorageInitializer} from "./storage.initializer";
import {PassportService} from "@spica-client/passport";
import {MatCheckboxModule} from '@angular/material/checkbox';

@NgModule({
  imports: [
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
    InputModule.withPlacers([
      {
        origin: "string",
        type: "storage",
        icon: "perm_media",
        color: "#ab1ada",
        placer: StorageComponent
      }
    ])
  ],
  declarations: [
    IndexComponent,
    PickerComponent,
    StorageDialogOverviewDialog,
    PickerDirective,
    StorageComponent,
    StorageViewComponent,
    ImageEditorComponent,
    AddFolderDialogComponent
  ],
  exports: [PickerDirective]
})
export class StorageModule {
  static forRoot(): ModuleWithProviders {
    return {
      ngModule: StorageModule,
      providers: [
        {
          provide: ACTIVITY_FACTORY,
          useValue: provideActivityFactory,
          multi: true
        },
        {
          provide: StorageInitializer,
          useClass: StorageInitializer,
          deps: [StorageService, RouteService, PassportService]
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

  static forChild(): ModuleWithProviders {
    return {ngModule: StorageModule, providers: []};
  }
}

export function provideStorageLoader(l: StorageInitializer) {
  return l.appInitializer.bind(l);
}
