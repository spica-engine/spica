import {Component, OnInit} from "@angular/core";
import {fly, flyOne} from "../animations";
@Component({
  selector: "app-partners",
  templateUrl: "./partners.component.html",
  styleUrls: ["./partners.component.scss"],
  animations: [fly("fly"), flyOne("flyOne")]
})
export class PartnersComponent implements OnInit {
  constructor() {}

  ngOnInit() {}
}
