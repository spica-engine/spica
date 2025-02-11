import {NgModule} from "@angular/core";
import {MatClipboardDirective} from "./clipboard.directive";

@NgModule({
  declarations: [MatClipboardDirective],
  exports: [MatClipboardDirective]
})
export class MatClipboardModule {}
