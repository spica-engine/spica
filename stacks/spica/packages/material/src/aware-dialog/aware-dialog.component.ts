import {Component, ElementRef, Inject, TemplateRef, ViewChild} from "@angular/core";
import {MAT_DIALOG_DATA, MatDialogRef} from "@angular/material/dialog";

import {MatAwareDialogOptions} from "./options";

@Component({
  selector: "mat-aware-dialog",
  templateUrl: "./aware-dialog.component.html",
  styleUrls: ["./aware-dialog.component.scss"]
})
export class MatAwareDialogComponent {
  @ViewChild("confirmButton", {read: ElementRef, static: true}) confirmButton: ElementRef;

  constructor(
    @Inject(MAT_DIALOG_DATA) public options: MatAwareDialogOptions,
    public ref: MatDialogRef<MatAwareDialogComponent>
  ) {}

  get isTemplate(): boolean {
    return this.options.templateOrDescription instanceof TemplateRef;
  }
}
