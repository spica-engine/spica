import {Component, OnInit} from "@angular/core";
import {MatDialog} from "@angular/material/dialog";
import {ConfigurationComponent} from "@spica-client/function/components/configuration/configuration.component";

@Component({
  selector: "app-welcome",
  templateUrl: "./welcome.component.html",
  styleUrls: ["./welcome.component.scss"]
})
export class WelcomeComponent implements OnInit {
  constructor(private dialog: MatDialog) {}

  ngOnInit() {}
  addFunction() {
    this.dialog.open(ConfigurationComponent, {
      autoFocus: false
    });
  }
}
