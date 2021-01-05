import {Component} from "@angular/core";
import {fly, flyOne, flyOneByOne} from "../animations";

@Component({
  selector: "spica-home",
  templateUrl: "./home.component.html",
  styleUrls: ["./home.component.scss"],
  animations: [fly("fly"), flyOne("flyOne"), flyOneByOne("flyOneByOne")]
})
export class HomeComponent {
  slideIndex: number = 0;
  constructor() {}
}
