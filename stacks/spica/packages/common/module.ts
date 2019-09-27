import {NgModule} from "@angular/core";
import {PropertyKvPipe} from "./property_keyvalue.pipe";

@NgModule({
  declarations: [PropertyKvPipe],
  exports: [PropertyKvPipe]
})
export class CommonModule {}
