import {NgModule} from "@angular/core";
import {BuildLinkPipe, PropertyKvPipe} from "./pipes";
import {PersistHeaderWidthDirective} from "./directives";

@NgModule({
  declarations: [PropertyKvPipe, BuildLinkPipe, PersistHeaderWidthDirective],
  exports: [PropertyKvPipe, BuildLinkPipe, PersistHeaderWidthDirective]
})
export class CommonModule {}
