import {Component, Input, OnInit} from "@angular/core";
import {SafeUrl} from "@angular/platform-browser";

@Component({
  selector: "image-viewer",
  templateUrl: "./image-viewer.component.html",
  styleUrls: ["./image-viewer.component.scss"]
})
export class ImageViewerComponent implements OnInit {
  @Input() content: SafeUrl | string;

  constructor() {}

  ngOnInit(): void {}
}
