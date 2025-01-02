import {Component, Inject} from "@angular/core";
import {MAT_DIALOG_DATA} from "@angular/material/dialog";

@Component({
  selector: "storage-dialog-overview",
  templateUrl: "./storage-dialog-overview.html",
  styleUrls: ["./storage-dialog-overview.scss"]
})
export class StorageDialogOverviewDialog {
  constructor(@Inject(MAT_DIALOG_DATA) public data: any) {}
}
