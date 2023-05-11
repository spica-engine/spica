import {Component, Input, OnInit} from "@angular/core";
import {SafeUrl} from "@angular/platform-browser";

@Component({
  selector: "app-default-viewer",
  templateUrl: "./default-viewer.component.html",
  styleUrls: ["./default-viewer.component.scss"]
})
export class DefaultViewerComponent implements OnInit {
  @Input() error: string;
  @Input() content: SafeUrl | string;

  constructor() {}

  ngOnInit(): void {}
}
