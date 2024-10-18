import {AfterViewInit, Component, Input, OnInit} from "@angular/core";
import {DomSanitizer, SafeUrl} from "@angular/platform-browser";

@Component({
  selector: "default-viewer",
  templateUrl: "./default-viewer.component.html",
  styleUrls: ["./default-viewer.component.scss"]
})
export class DefaultViewerComponent implements AfterViewInit {
  content;

  constructor(private sanitizer: DomSanitizer) {}

  ngAfterViewInit(): void {
    this.content = this.sanitizer.bypassSecurityTrustUrl(URL.createObjectURL(this.content));
  }
}
