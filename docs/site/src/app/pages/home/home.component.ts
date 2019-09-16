import {Component} from "@angular/core";
import {flyFromLeft} from "../animations";

@Component({
  selector: "spica-home",
  templateUrl: "./home.component.html",
  styleUrls: ["./home.component.scss"],
  animations: [flyFromLeft("inviewport2")]
})
export class HomeComponent {
  constructor() {}
}
