import {Component, Inject} from "@angular/core";
import {MAT_DIALOG_DATA} from "@angular/material/dialog";
import {DomSanitizer, SafeResourceUrl} from "@angular/platform-browser";

@Component({
  selector: "passport-strategy-dialog",
  templateUrl: "./strategy-dialog.component.html",
  styleUrls: ["./strategy-dialog.component.scss"]
})
export class StrategyDialogComponent {
  loaded = false;

  url: SafeResourceUrl;

  constructor(@Inject(MAT_DIALOG_DATA) public data: any, sanitizer: DomSanitizer) {
    this.url = sanitizer.bypassSecurityTrustResourceUrl(data.url);
  }
}
