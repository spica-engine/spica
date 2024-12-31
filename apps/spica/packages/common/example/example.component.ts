import {Component, OnInit, Inject} from "@angular/core";
import {MAT_LEGACY_DIALOG_DATA as MAT_DIALOG_DATA, MatLegacyDialogRef as MatDialogRef} from "@angular/material/legacy-dialog";

@Component({
  selector: "example",
  templateUrl: "./example.component.html",
  styleUrls: ["./example.component.scss"]
})
export class ExampleComponent implements OnInit {
  constructor(
    @Inject(MAT_DIALOG_DATA) public data: any,
    public dialogRef: MatDialogRef<ExampleComponent>
  ) {}

  ngOnInit(): void {}
}
