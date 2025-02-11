import {Component, OnInit} from "@angular/core";
import {MatDialog, MatDialogRef} from "@angular/material/dialog";
import {ActivatedRoute, Router} from "@angular/router";
import {StrategyDialogComponent} from "@spica-client/passport/components/strategy-dialog/strategy-dialog.component";
import {Observable, of} from "rxjs";
import {take, finalize, tap, skipWhile, map, filter, switchMap} from "rxjs/operators";
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

  authFactor;

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
        this.identify(params.strategy);
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
    let identifyObs;
    if (strategy) {
      let dialog: MatDialogRef<unknown, unknown>;
      identifyObs = this.passport
        .identify(strategy, url => {
          dialog = this.dialog.open(StrategyDialogComponent, {
            data: {url},
            closeOnNavigation: true,
            panelClass: "strategy-dialog",
            minWidth: "60vw",
            minHeight: "70vh"
          });
        })
        .pipe(finalize(() => dialog.close()));
    } else {
      identifyObs = this.passport.identify(this.identity);
    }

    identifyObs
      .pipe(
        take(1),
        filter((r: any) => {
          if (r.challenge) {
            this.authFactor = r;
          }
          return !this.authFactor;
        })
      )
      .subscribe(
        r => {
          this.passport.onTokenRecieved(r);
          return this.router.navigate(["/dashboard"]);
        },
        r => (this.error = r.error.message)
      );
  }

  answerChallenge(answer: string) {
    return this.passport
      .answerAuthFactor(this.authFactor, answer)
      .toPromise()
      .then(r => {
        this.passport.onTokenRecieved(r);
        return this.router.navigate(["/dashboard"]);
      })
      .catch(response => {
        this.error = response.error.message;
        this.authFactor = undefined;
      });
  }
}
