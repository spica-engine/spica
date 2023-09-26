import {Component, Inject, TemplateRef} from "@angular/core";
import {MatDialogRef, MAT_DIALOG_DATA} from "@angular/material/dialog";
import {MatAwareDialogOptions} from "./options";

@Component({
  selector: "mat-mdc-aware-dialog",
  templateUrl: "./aware-dialog.component.html",
  styleUrls: ["./aware-dialog.component.scss"]
})
export class MatAwareDialogComponent {
  constructor(
    @Inject(MAT_DIALOG_DATA) public options: MatAwareDialogOptions,
    public ref: MatDialogRef<MatAwareDialogComponent>
  ) {}

  get isTemplate(): boolean {
    return this.options.templateOrDescription instanceof TemplateRef;
  }
}
