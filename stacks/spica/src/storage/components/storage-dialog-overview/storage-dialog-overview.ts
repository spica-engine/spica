import {Component, Inject} from "@angular/core";
import {MAT_DIALOG_DATA, MatDialogRef} from "@angular/material/dialog";

@Component({
  selector: "storage-dialog-overview",
  templateUrl: "./storage-dialog-overview.html",
  styleUrls: ["./storage-dialog-overview.scss"]
})
// tslint:disable-next-line:component-class-suffix
export class StorageDialogOverviewDialog {
  constructor(
    public dialogRef: MatDialogRef<StorageDialogOverviewDialog>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {}

  onNoClick(): void {
    this.dialogRef.close();
  }
}
