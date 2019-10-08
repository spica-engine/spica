import {Component, Input, OnInit} from "@angular/core";

@Component({
  selector: "home-section",
  templateUrl: "./home-section.component.html",
  styleUrls: ["./home-section.component.scss"],
  host: {
    "attr.role": "article"
  }
})
export class HomeSectionComponent implements OnInit {
  @Input() title: string;
  @Input() description: string;
  @Input() subtitle: string;
  @Input("cnFxLayout.lt-md") fxLayoutLtMd: string = "column wrap";
  @Input("cnFxLayoutAlign.lt-md") fxLayoutAlignMd: string = "center center";
  @Input("cnFxLayout.gt-sm") fxLayoutGtSm: string = "row wrap";
  @Input("cnFxLayoutAlign.gt-sm") fxLayoutAlignGtSm: string = "space-around center";
  @Input("cnFxLayoutGap") fxLayoutGap: string = "0px";

  constructor() {}

  ngOnInit() {}
}
