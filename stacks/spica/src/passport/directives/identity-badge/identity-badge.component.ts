import {Component} from "@angular/core";
import {Router} from "@angular/router";
import {Identity} from "../../interfaces/identity";
import {PassportService} from "../../services/passport.service";

@Component({
  selector: "passport-identity-badge",
  templateUrl: "./identity-badge.component.html",
  styleUrls: ["./identity-badge.component.scss"]
})
export class IdentityBadgeComponent {
  identity: Identity;

  constructor(private passportService: PassportService, private router: Router) {
    this.identity = this.passportService.decodedToken;
  }

  unidentify() {
    this.passportService.logout();
    this.router.navigate(["passport/identify"]);
  }
}
