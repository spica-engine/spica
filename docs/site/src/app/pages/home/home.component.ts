import {Component} from "@angular/core";
import {fly, flyOne} from "../animations";

@Component({
  selector: "spica-home",
  templateUrl: "./home.component.html",
  styleUrls: ["./home.component.scss"],
  animations: [fly("fly"), flyOne("flyOne")]
})
export class HomeComponent {
  constructor() {}
}
