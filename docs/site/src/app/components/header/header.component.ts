import {Component, OnInit} from "@angular/core";

@Component({
  selector: "app-header",
  templateUrl: "./header.component.html",
  styleUrls: ["./header.component.scss"],
  host: {
    "aria-role": "heading",
    "aria-level": "1"
  }
})
export class HeaderComponent implements OnInit {
  constructor() {}

  ngOnInit() {}
}
