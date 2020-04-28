import {NgModule} from "@angular/core";
import {PropertyKvPipe} from "./property_keyvalue.pipe";
import {HighlightPipe} from "./highlight.pipe";
import {BuildLinkPipe} from "./build_link.pipe";

@NgModule({
  declarations: [PropertyKvPipe, HighlightPipe, BuildLinkPipe],
  exports: [PropertyKvPipe, HighlightPipe, BuildLinkPipe]
})
export class CommonModule {}
