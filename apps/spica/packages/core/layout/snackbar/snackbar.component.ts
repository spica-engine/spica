import {Component, Inject, HostListener} from "@angular/core";
import {MAT_SNACK_BAR_DATA, MatSnackBarRef} from "@angular/material/snack-bar";
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
