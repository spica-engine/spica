import {CommonModule} from "@angular/common";
import {NgModule} from "@angular/core";
import {FormsModule, ReactiveFormsModule} from "@angular/forms";
import {MatButtonModule} from "@angular/material/button";
import {MatIconModule} from "@angular/material/icon";
import {MatInputModule} from "@angular/material/input";
import {MatSelectModule} from "@angular/material/select";
import {StorageModule} from "../../../../storage/storage.module";
import {TextEditorToolbarComponent} from "./text-editor-toolbar.component";
import {TextEditorComponent} from "./text-editor.component";

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    StorageModule,
    MatSelectModule,
    MatInputModule,
    MatIconModule,
    MatButtonModule
  ],
  declarations: [TextEditorComponent, TextEditorToolbarComponent],
  exports: [TextEditorComponent, TextEditorToolbarComponent]
})
export class TextEditorModule {}
