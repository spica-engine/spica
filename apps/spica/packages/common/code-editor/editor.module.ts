import {NgModule} from "@angular/core";
import {EditorComponent} from "./editor.component";
import {LayoutModule} from "@spica-client/core/layout";

@NgModule({
  imports: [LayoutModule],
  declarations: [EditorComponent],
  exports: [EditorComponent]
})
export class EditorModule {}
