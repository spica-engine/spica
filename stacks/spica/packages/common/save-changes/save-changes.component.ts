import {Component, OnInit} from "@angular/core";
import {MatDialogRef} from "@angular/material/dialog";

@Component({
  selector: "save-changes",
  templateUrl: "./save-changes.component.html",
  styleUrls: ["./save-changes.component.scss"]
})
export class SaveChangesComponent implements OnInit {
  constructor(public dialogRef: MatDialogRef<any>) {}

  ngOnInit(): void {}

  emit(decision) {
    this.dialogRef.close(decision);
  }
}
