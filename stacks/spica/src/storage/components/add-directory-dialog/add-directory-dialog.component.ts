import {Component, Inject, OnInit} from "@angular/core";
import {NgModel} from "@angular/forms";
import {MAT_DIALOG_DATA, MatDialogRef} from "@angular/material/dialog";

@Component({
  selector: "add-directory-dialog",
  templateUrl: "./add-directory-dialog.component.html",
  styleUrls: ["./add-directory-dialog.component.scss"]
})
export class AddDirectoryDialog implements OnInit {
  name: string;
  constructor(
    @Inject(MAT_DIALOG_DATA) public data: any,
    public dialogRef: MatDialogRef<AddDirectoryDialog>
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
