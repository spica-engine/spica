import {Component, OnInit} from "@angular/core";
import {MatDialog, MatDialogRef} from "@angular/material/dialog";
import {ActivatedRoute, Router} from "@angular/router";
import {StrategyDialogComponent} from "@spica-client/passport/components/strategy-dialog/strategy-dialog.component";
import {Observable} from "rxjs";
import {take, finalize} from "rxjs/operators";
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

  constructor(
    public passport: PassportService,
    public router: Router,
    private activatedRoute: ActivatedRoute,
    private dialog: MatDialog
  ) {}

  ngOnInit() {
    this.strategies = this.passport.getStrategies();
    this.activatedRoute.queryParams.pipe(take(1)).subscribe(params => {
      if (params.strategy) {
        let dialog: MatDialogRef<unknown, unknown>;
        this.passport
          .identifyWith(params.strategy, url => {
            dialog = this.dialog.open(StrategyDialogComponent, {
              data: {url},
              closeOnNavigation: true,
              panelClass: "strategy-dialog",
              minWidth: "60vw",
              minHeight: "70vh"
            });
          })
          .pipe(finalize(() => dialog.close()))
          .toPromise()
          .then(() => this.router.navigate(["/dashboard"]));
      } else {
        if (params.token) {
          this.passport.token = params.token;
        }
        if (this.passport.identified) {
          this.router.navigate([""]);
        }
      }
    });
  }

  identify(strategy?: string) {
    (strategy ? this.passport.identifyWith(strategy) : this.passport.identify(this.identity))
      .toPromise()
      .then(() => this.router.navigate(["/dashboard"]))
      .catch(response => (this.error = response.error.message));
  }
}
