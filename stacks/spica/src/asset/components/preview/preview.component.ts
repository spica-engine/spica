import {Component, Input, OnInit} from "@angular/core";
import {MatDialog} from "@angular/material/dialog";
import {displayPreview} from "@spica-client/asset/helpers";
import {InstallationPreviewByModules, Resource} from "../../interfaces";

@Component({
  selector: "asset-preview",
  templateUrl: "./preview.component.html",
  styleUrls: ["./preview.component.scss"]
})
export class PreviewComponent {
  @Input() preview: InstallationPreviewByModules;

  constructor(public dialog: MatDialog) {}

  show(resources: Resource[]) {
    displayPreview(this.dialog, resources);
  }
}
