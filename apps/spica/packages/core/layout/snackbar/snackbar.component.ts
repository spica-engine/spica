import {Component, Inject, HostListener} from "@angular/core";
import {MAT_LEGACY_SNACK_BAR_DATA as MAT_SNACK_BAR_DATA, MatLegacySnackBarRef as MatSnackBarRef} from "@angular/material/legacy-snack-bar";
import {SnackbarError} from "./interface";

@Component({
  selector: "snackbar",
  templateUrl: "./snackbar.component.html",
  styleUrls: ["./snackbar.component.scss"]
})
export class SnackbarComponent {
  error: SnackbarError;
  constructor(
    public snackBarRef: MatSnackBarRef<SnackbarComponent>,
    @Inject(MAT_SNACK_BAR_DATA) public data: SnackbarError
  ) {
    this.error = data;
  }

  @HostListener("click")
  close() {
    this.snackBarRef.dismiss();
  }
}
