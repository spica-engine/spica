import {CommonModule} from "@angular/common";
import {NgModule} from "@angular/core";
import {MatIconModule} from "@angular/material/icon";
import {AsyncTaskComponent} from "./async-task.component";
import {MatProgressSpinnerModule} from "@angular/material/progress-spinner";

@NgModule({
  imports: [CommonModule, MatIconModule, MatProgressSpinnerModule],
  declarations: [AsyncTaskComponent],
  exports: [AsyncTaskComponent]
})
export class AsyncTaskModule {}
