import {Component, Inject, TemplateRef} from "@angular/core";
import {MatLegacyDialogRef as MatDialogRef, MAT_LEGACY_DIALOG_DATA as MAT_DIALOG_DATA} from "@angular/material/legacy-dialog";
import {MatAwareDialogOptions} from "./options";

@Component({
  selector: "mat-aware-dialog",
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
