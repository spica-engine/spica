import {Component, OnInit} from "@angular/core";
import {MatLegacyDialog as MatDialog} from "@angular/material/legacy-dialog";
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
