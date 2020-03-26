import {NgModule} from "@angular/core";
import {PropertyKvPipe} from "./property_keyvalue.pipe";
import {HighlightPipe} from "./highlight.pipe";
import {ObjectIdToDatePipe} from "./objectId_date.pipe";

@NgModule({
  declarations: [PropertyKvPipe, HighlightPipe],
  exports: [PropertyKvPipe, HighlightPipe]
})
export class CommonModule {}

@NgModule({
  imports: [],
  declarations: [ObjectIdToDatePipe],
  exports: [ObjectIdToDatePipe]
})
export class ToDatePipeModule {
  static forRoot() {
    return {ngModule: ToDatePipeModule, provider: []};
  }
}
