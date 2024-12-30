import {Component, Inject} from "@angular/core";
import {MAT_LEGACY_DIALOG_DATA as MAT_DIALOG_DATA} from "@angular/material/legacy-dialog";

@Component({
  selector: "storage-dialog-overview",
  templateUrl: "./storage-dialog-overview.html",
  styleUrls: ["./storage-dialog-overview.scss"]
})
export class StorageDialogOverviewDialog {
  constructor(@Inject(MAT_DIALOG_DATA) public data: any) {}
}
