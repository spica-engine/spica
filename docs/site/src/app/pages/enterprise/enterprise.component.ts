import {Component, OnInit} from "@angular/core";
import {fly, flyOne} from "../animations";
@Component({
  selector: "app-enterprise",
  templateUrl: "./enterprise.component.html",
  styleUrls: ["./enterprise.component.scss"],
  animations: [fly("fly"), flyOne("flyOne")]
})
export class EnterpriseComponent implements OnInit {
  constructor() {}

  ngOnInit() {}
}
