import {NgModule} from "@angular/core";
import {MatSaveDirective} from "../save/save.directive";

@NgModule({
  declarations: [MatSaveDirective],
  exports: [MatSaveDirective]
})
export class MatSaveModule {}
