import {NgModule} from "@angular/core";
import {BuildLinkPipe, PropertyKvPipe, MapPipe} from "./pipes";
import {PersistHeaderWidthDirective} from "./directives";

@NgModule({
  declarations: [PropertyKvPipe, BuildLinkPipe, PersistHeaderWidthDirective, MapPipe],
  exports: [PropertyKvPipe, BuildLinkPipe, PersistHeaderWidthDirective, MapPipe]
})
export class CommonModule {}
