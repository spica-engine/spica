import {Component, OnInit} from "@angular/core";
import {Router} from "@angular/router";
import {Observable} from "rxjs";
import {Strategy} from "../../interfaces/strategy";
import {IdentifyParams, PassportService} from "../../services/passport.service";

@Component({
  selector: "passport-identify",
  templateUrl: "./identify.component.html",
  styleUrls: ["./identify.component.scss"]
})
export class IdentifyComponent implements OnInit {
  public identity: IdentifyParams = {password: undefined, identifier: undefined};
  public error: string;

  strategies: Observable<Strategy[]>;

  constructor(public passport: PassportService, public router: Router) {}

  ngOnInit() {
    this.strategies = this.passport.getStrategies();
    if (this.passport.identified) {
      this.router.navigate([""]);
    }
  }

  identify(strategy?: Strategy) {
    (strategy ? this.passport.identifyWith(strategy.name) : this.passport.identify(this.identity))
      .toPromise()
      .then(() => this.router.navigate(["/dashboard"]))
      .catch(response => (this.error = response.error.message));
  }
}
