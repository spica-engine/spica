import {Component, OnInit} from "@angular/core";
import {fly, flyOne, flyOneByOne} from "../animations";
@Component({
  selector: "app-features",
  templateUrl: "./features.component.html",
  styleUrls: ["./features.component.scss"],
  animations: [fly("fly"), flyOne("flyOne"), flyOneByOne("flyOneByOne")]
})
export class FeaturesComponent implements OnInit {
  constructor() {}

  ngOnInit() {}
}
