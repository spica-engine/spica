import {Component, OnInit, TemplateRef, ViewChild, OnDestroy} from "@angular/core";
import {BlacklistedToken, emptyBlacklistedToken} from "src/passport/interfaces/blacklistedtoken";
import {Router, ActivatedRoute} from "@angular/router";
import {filter, switchMap, takeUntil, tap, map, take, switchMapTo} from "rxjs/operators";
import {BlacklistedTokenService} from "src/passport/services/blacklistedtoken.service";
import {Subject, of} from "rxjs";
import {PolicyService} from "src/passport/services/policy.service";
import {PassportService} from "@spica-client/passport/services/passport.service";

@Component({
  selector: "passport-blacklistedtoken-add",
  templateUrl: "./blacklistedtoken-add.component.html",
  styleUrls: ["./blacklistedtoken-add.component.scss"]
})
export class BlacklistedTokenAddComponent implements OnInit, OnDestroy {
  @ViewChild("toolbar", {static: true}) toolbar: TemplateRef<any>;
  public blacklistedToken: BlacklistedToken = emptyBlacklistedToken();

  private onDestroy: Subject<void> = new Subject<void>();

  public viewState: "meta" = "meta";

  constructor(
    private router: Router,
    private activatedRoute: ActivatedRoute,
    private blacklistedTokenService: BlacklistedTokenService,
    private policyService: PolicyService,
    private passportService: PassportService
  ) {}

  ngOnInit() {
    this.activatedRoute.params
      .pipe(
        filter(params => params.id),
        switchMap(params => this.blacklistedTokenService.get(params.id)),
        tap(blacklistedToken => (this.blacklistedToken = blacklistedToken)),
        switchMapTo(
          this.passportService
            .checkAllowed("passport:policy:index")
            .pipe(switchMap(result => (result ? this.policyService.find() : of({data: []}))))
        ),
        takeUntil(this.onDestroy)
      )
      .subscribe();
  }

  saveBlacklistedToken() {
    this.blacklistedTokenService
          .insertOne(this.blacklistedToken)
          .toPromise()
          .then(() => this.router.navigate(["passport/blacklistedtoken"]));
  }

  ngOnDestroy() {
    this.onDestroy.next();
  }
}
