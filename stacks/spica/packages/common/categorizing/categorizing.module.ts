import {NgModule} from "@angular/core";
import {CategorizingComponent} from "./categorizing.component";
import {LayoutModule} from "@spica-client/core/layout";
import {MatSelectModule} from "@angular/material/select";
import {MatIconModule} from "@angular/material/icon";
import {MatButtonModule} from "@angular/material/button";
import {MatDividerModule} from "@angular/material/divider";
import {MatFormFieldModule} from "@angular/material/form-field";
import {MatInputModule} from "@angular/material/input";
import {FormsModule} from "@angular/forms";
import { CommonModule } from "@angular/common";

@NgModule({
  imports: [
    CommonModule,
    LayoutModule,
    MatInputModule,
    MatSelectModule,
    MatIconModule,
    MatButtonModule,
    MatDividerModule,
    MatFormFieldModule,
    FormsModule
  ],
  declarations: [CategorizingComponent],
  exports: [CategorizingComponent]
})
export class CategorizingModule {}
