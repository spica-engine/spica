import {Component, Input, OnInit} from "@angular/core";
import {displayPreview} from "@spica-client/asset/helpers";
import {InstallationPreviewByModules, Resource} from "../../interfaces";

@Component({
  selector: "asset-preview",
  templateUrl: "./preview.component.html",
  styleUrls: ["./preview.component.scss"]
})
export class PreviewComponent {
  @Input() preview: InstallationPreviewByModules;

  constructor() {}

  show(resources: Resource[]) {
    displayPreview(resources);
  }
}
