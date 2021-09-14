import {Component, Inject} from "@angular/core";
import {MatDialogRef, MAT_DIALOG_DATA} from "@angular/material/dialog";
import {Observable} from "rxjs";

@Component({
  selector: "configuration",
  templateUrl: "./configuration.component.html",
  styleUrls: ["./configuration.component.scss"]
})
export class ConfigurationComponent {
  information: Observable<any>;

  apiUrl;
  constructor(
    @Inject(MAT_DIALOG_DATA) public data: any,
    public dialogRef: MatDialogRef<ConfigurationComponent>
  ) {
    this.apiUrl = data.apiUrl;
    this.information = data.information;
    this.data.function.triggers = [
      {
        type: undefined,
        active: true,
        handler: "default",
        options: {}
      }
    ];
    this.data.function.language = "javascript";
  }

  formatTimeout(value: number) {
    if (value >= 60) {
      return (Math.round((value / 60) * 100 + Number.EPSILON) / 100).toFixed(1) + "m";
    }
    return `${value}s`;
  }
}
