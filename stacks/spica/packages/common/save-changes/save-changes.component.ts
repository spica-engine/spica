import {Component, OnInit} from "@angular/core";
import {MatDialog, MatDialogRef} from "@angular/material/dialog";

@Component({
  selector: "app-save-changes",
  templateUrl: "./save-changes.component.html",
  styleUrls: ["./save-changes.component.scss"]
})
export class SaveChangesComponent implements OnInit {
  constructor(public dialogRef: MatDialogRef<any>) {}

  ngOnInit(): void {}

  emit(decision: string) {
    this.dialogRef.close(decision);
  }
}
