import {Component, OnInit} from "@angular/core";
import {fly, flyOne} from "../animations";
@Component({
  selector: "app-features",
  templateUrl: "./features.component.html",
  styleUrls: ["./features.component.scss"],
  animations: [fly("fly"), flyOne("flyOne")]
})
export class FeaturesComponent implements OnInit {
  constructor() {}

  ngOnInit() {}
}
