import {Component, Input, OnInit} from "@angular/core";
import {DomSanitizer, SafeUrl} from "@angular/platform-browser";

@Component({
  selector: "image-viewer",
  templateUrl: "./image-viewer.component.html",
  styleUrls: ["./image-viewer.component.scss"]
})
export class ImageViewerComponent implements OnInit {
  @Input() content;

  constructor(private sanitizer: DomSanitizer) {}

  ngOnInit(): void {
    this.content = this.sanitizer.bypassSecurityTrustUrl(URL.createObjectURL(this.content));
  }
}
