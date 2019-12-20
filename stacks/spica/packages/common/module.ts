import {NgModule} from "@angular/core";
import {PropertyKvPipe} from "./property_keyvalue.pipe";
import {HighlightPipe} from "./highlight.pipe";

@NgModule({
  declarations: [PropertyKvPipe, HighlightPipe],
  exports: [PropertyKvPipe, HighlightPipe]
})
export class CommonModule {}
