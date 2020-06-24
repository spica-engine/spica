import {NgModule} from "@angular/core";
import {PropertyKvPipe} from "./property_keyvalue.pipe";
import {BuildLinkPipe} from "./build_link.pipe";

@NgModule({
  declarations: [PropertyKvPipe, BuildLinkPipe],
  exports: [PropertyKvPipe, BuildLinkPipe]
})
export class CommonModule {}
