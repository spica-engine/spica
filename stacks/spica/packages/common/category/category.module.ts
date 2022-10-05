import {NgModule} from "@angular/core";
import {CategoryComponent} from "./category.component";
import {MatSelectModule} from "@angular/material/select";
import {MatIconModule} from "@angular/material/icon";
import {MatButtonModule} from "@angular/material/button";
import {MatDividerModule} from "@angular/material/divider";
import {MatFormFieldModule} from "@angular/material/form-field";
import {MatInputModule} from "@angular/material/input";
import {FormsModule} from "@angular/forms";
import {CommonModule} from "@angular/common";
import {LayoutModule} from "@spica-client/core";
import {MatToolbarModule} from "@angular/material/toolbar";
import {DragDropModule} from "@angular/cdk/drag-drop";
import {MatExpansionModule} from "@angular/material/expansion";
import {MatAwareDialogModule} from "@spica-client/material";
import {MatCardModule} from "@angular/material/card";
import {CategoryService} from "./category.service";

@NgModule({
  imports: [
    CommonModule,
    MatInputModule,
    MatSelectModule,
    MatIconModule,
    MatButtonModule,
    MatDividerModule,
    MatFormFieldModule,
    FormsModule,
    LayoutModule,
    MatToolbarModule,
    DragDropModule,
    MatExpansionModule,
    MatAwareDialogModule,
    MatCardModule
  ],
  declarations: [CategoryComponent],
  providers: [CategoryService],
  exports: [CategoryComponent]
})
export class CategoryModule {}
