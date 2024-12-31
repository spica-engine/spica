import {Component, Inject, OnInit} from "@angular/core";
import {MAT_LEGACY_DIALOG_DATA as MAT_DIALOG_DATA} from "@angular/material/legacy-dialog";

@Component({
  selector: "app-resources",
  templateUrl: "./resources.component.html",
  styleUrls: ["./resources.component.scss"]
})
export class ResourcesComponent implements OnInit {
  constructor(@Inject(MAT_DIALOG_DATA) public data) {}

  ngOnInit(): void {}
}
