import {Component, Input, OnInit} from "@angular/core";
import {DomSanitizer} from "@angular/platform-browser";

@Component({
  selector: "video-viewer",
  templateUrl: "./video-viewer.component.html",
  styleUrls: ["./video-viewer.component.scss"]
})
export class VideoViewerComponent implements OnInit {
  @Input() autoplay: boolean;

  @Input() contentType: string;
  @Input() content;

  constructor(private sanitizer: DomSanitizer) {}

  ngOnInit(): void {
    this.content = this.sanitizer.bypassSecurityTrustUrl(URL.createObjectURL(this.content));
  }
}
