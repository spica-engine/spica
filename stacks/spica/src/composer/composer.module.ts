import {CommonModule} from "@angular/common";
import {ModuleWithProviders, NgModule} from "@angular/core";
import {FormsModule} from "@angular/forms";
import {MatButtonModule} from "@angular/material/button";
import {MatCardModule} from "@angular/material/card";
import {MatChipsModule} from "@angular/material/chips";
import {MatDialogModule} from "@angular/material/dialog";
import {MatDividerModule} from "@angular/material/divider";
import {MatExpansionModule} from "@angular/material/expansion";
import {MatIconModule} from "@angular/material/icon";
import {MatInputModule} from "@angular/material/input";
import {MatListModule} from "@angular/material/list";
import {MatMenuModule} from "@angular/material/menu";
import {MatPaginatorModule} from "@angular/material/paginator";
import {MatProgressSpinnerModule} from "@angular/material/progress-spinner";
import {MatSelectModule} from "@angular/material/select";
import {MatSlideToggleModule} from "@angular/material/slide-toggle";
import {MatTabsModule} from "@angular/material/tabs";
import {MatTooltipModule} from "@angular/material/tooltip";
import {InputModule} from "@spica-client/common";
import {MccColorPickerModule} from "material-community-components";

import {BuildProgressComponent} from "./components/build-progress/build-progress.component";
import {BuilderComponent} from "./components/builder/builder.component";
import {CreatorComponent} from "./components/creator/creator.component";
import {ImagePickerComponent} from "./components/image-picker/image-picker.component";
import {PageDeleteDialogComponent} from "./components/page-delete-dialog/page-delete-dialog.component";
import {ViewportComponent} from "./components/viewport/viewport.component";
import {ComposeComponent} from "./compose/compose.component";
import {ComposerRoutingModule} from "./composer-routing.module";
import {COMPOSER_OPTIONS, ComposerOptions} from "./options";

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    ComposerRoutingModule,
    InputModule,
    MatCardModule,
    MatDialogModule,
    MatTooltipModule,
    MatButtonModule,
    MatSelectModule,
    MatInputModule,
    MatMenuModule,
    MatDividerModule,
    MatSlideToggleModule,
    MatTabsModule,
    MatExpansionModule,
    MatPaginatorModule,
    MatIconModule,
    MatChipsModule,
    MatListModule,
    MatProgressSpinnerModule,
    MccColorPickerModule.forRoot({})
  ],
  declarations: [
    ComposeComponent,
    ViewportComponent,
    BuilderComponent,
    CreatorComponent,
    PageDeleteDialogComponent,
    BuildProgressComponent,
    ImagePickerComponent
  ]
  // entryComponents: [
  //   BuilderComponent,
  //   PageDeleteDialogComponent,
  //   BuildProgressComponent,
  //   CreatorComponent
  // ]
})
export class ComposerModule {
  static forRoot(options: ComposerOptions): ModuleWithProviders<ComposerModule> {
    return {ngModule: ComposerModule, providers: [{provide: COMPOSER_OPTIONS, useValue: options}]};
  }
}
