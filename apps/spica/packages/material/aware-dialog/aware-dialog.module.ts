import {CommonModule} from "@angular/common";
import {NgModule} from "@angular/core";
import {FormsModule} from "@angular/forms";
import {MatButtonModule} from "@angular/material/button";
import {MatDialogModule} from "@angular/material/dialog";
import {MatFormFieldModule} from "@angular/material/form-field";
import {MatIconModule} from "@angular/material/icon";
import {MatInputModule} from "@angular/material/input";
import {MatAwareDialogComponent} from "./aware-dialog.component";
import {MatAwareDialogDirective} from "./aware-dialog.directive";

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule
  ],
  declarations: [MatAwareDialogComponent, MatAwareDialogDirective],
  exports: [MatAwareDialogComponent, MatAwareDialogDirective]
})
export class MatAwareDialogModule {}
