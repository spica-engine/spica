import {Component, OnInit} from "@angular/core";
import {Router, ActivatedRoute} from "@angular/router";
import {Observable} from "rxjs";
import {Strategy} from "../../interfaces/strategy";
import {IdentifyParams, PassportService} from "../../services/passport.service";
import {tap, take, map} from "rxjs/operators";

@Component({
  selector: "passport-identify",
  templateUrl: "./identify.component.html",
  styleUrls: ["./identify.component.scss"]
})
export class IdentifyComponent implements OnInit {
  public identity: IdentifyParams = {password: undefined, identifier: undefined};
  public error: string;

  strategies: Observable<Strategy[]>;

  constructor(
    public passport: PassportService,
    public router: Router,
    private activatedRoute: ActivatedRoute
  ) {}

  ngOnInit() {
    this.strategies = this.passport.getStrategies();
    this.activatedRoute.queryParams
      .pipe(
        map(params => params.token),
        tap(token => {
          if (token) this.passport.token = token;
          if (this.passport.identified) {
            this.router.navigate([""]);
          }
        }),
        take(1)
      )
      .subscribe();
  }

  identify(strategy?: Strategy) {
    (strategy ? this.passport.identifyWith(strategy.name) : this.passport.identify(this.identity))
      .toPromise()
      .then(() => this.router.navigate(["/dashboard"]))
      .catch(response => (this.error = response.error.message));
  }
}
