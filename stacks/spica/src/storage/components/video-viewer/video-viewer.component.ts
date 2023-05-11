import {Component, Input, OnInit} from "@angular/core";
import {SafeUrl} from "@angular/platform-browser";

@Component({
  selector: "app-video-viewer",
  templateUrl: "./video-viewer.component.html",
  styleUrls: ["./video-viewer.component.scss"]
})
export class VideoViewerComponent implements OnInit {
  // clicking video is opening and autostarting video in the modal but the video on the background plays too.
  @Input() autoplay: boolean;

  @Input() content: SafeUrl | string;
  @Input() contentType: string;


  constructor() {}

  ngOnInit(): void {}
}
