import {Component, OnInit} from "@angular/core";
import {Router} from "@angular/router";
import {PassportService} from "../../services/passport.service";

@Component({
  selector: "passport-identity-badge",
  templateUrl: "./identity-badge.component.html",
  styleUrls: ["./identity-badge.component.scss"]
})
export class IdentityBadgeComponent implements OnInit {
  public identity;

  constructor(private passportService: PassportService, private router: Router) {
    this.identity = this.passportService.decodedToken;
  }

  public isIdentified = false;

  ngOnInit() {
    this.isIdentified = this.passportService.identified;
  }

  unidentify() {
    this.passportService.logout();
    this.router.navigate(["passport/identify"]);
  }
}
