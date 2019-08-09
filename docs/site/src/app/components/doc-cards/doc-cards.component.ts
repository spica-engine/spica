import {Component, OnInit} from "@angular/core";

@Component({
  templateUrl: "./doc-cards.component.html",
  styleUrls: ["./doc-cards.component.css"],
  host: {
    role: "document"
  }
})
export class DocCardsComponent implements OnInit {
  constructor() {}

  ngOnInit() {}
}
