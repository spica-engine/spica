import {Component, Inject, OnInit} from "@angular/core";
import { NgModel } from "@angular/forms";
import {MAT_DIALOG_DATA, MatDialogRef} from "@angular/material/dialog";

@Component({
  selector: "app-add-folder-dialog",
  templateUrl: "./add-folder-dialog.component.html",
  styleUrls: ["./add-folder-dialog.component.scss"]
})
export class AddFolderDialogComponent implements OnInit {
  name: string;
  constructor(
    @Inject(MAT_DIALOG_DATA) public data: any,
    public dialogRef: MatDialogRef<AddFolderDialogComponent>
  ) {}

  ngOnInit(): void {}

  updateExistsState(model: NgModel, name: string) {
    if (this.data.existingNames.includes(name)) {
      model.control.setErrors({
        nameExists: true
      });
    }
  }

}
