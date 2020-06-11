import {Component, OnInit, Inject} from "@angular/core";
import {MAT_SNACK_BAR_DATA, MatSnackBarRef} from "@angular/material";
import {SnackbarError} from "./interface";

@Component({
  selector: "snackbar",
  templateUrl: "./snackbar.component.html",
  styleUrls: ["./snackbar.component.scss"]
})
export class SnackbarComponent implements OnInit {
  error: SnackbarError;
  constructor(
    public snackBarRef: MatSnackBarRef<SnackbarComponent>,
    @Inject(MAT_SNACK_BAR_DATA) public data: SnackbarError
  ) {
    this.error = data;
  }

  ngOnInit() {}

  close() {
    this.snackBarRef.dismiss();
  }
}
