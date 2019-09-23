import {Component, OnInit} from "@angular/core";
import {fly, flyOne} from "../../pages/animations";
@Component({
  selector: "app-footer",
  templateUrl: "./footer.component.html",
  styleUrls: ["./footer.component.scss"],
  animations: [fly("fly"), flyOne("flyOne")]
})
export class FooterComponent implements OnInit {
  constructor() {}

  ngOnInit() {}
}
