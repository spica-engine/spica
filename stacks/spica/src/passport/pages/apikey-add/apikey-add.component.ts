import {Component, OnInit, TemplateRef, ViewChild, OnDestroy} from "@angular/core";
import {ApiKey, emptyApiKey} from "src/passport/interfaces/apikey";
import {Router, ActivatedRoute} from "@angular/router";
import {filter, switchMap, takeUntil, tap, map, take, switchMapTo} from "rxjs/operators";
import {ApiKeyService} from "src/passport/services/apikey.service";
import {Subject, of} from "rxjs";
import {Policy} from "src/passport/interfaces/policy";
import {PolicyService} from "src/passport/services/policy.service";
import {PassportService} from "@spica-client/passport/services/passport.service";

@Component({
  selector: "passport-apikey-add",
  templateUrl: "./apikey-add.component.html",
  styleUrls: ["./apikey-add.component.scss"]
})
export class ApiKeyAddComponent implements OnInit, OnDestroy {
  @ViewChild("toolbar", {static: true}) toolbar: TemplateRef<any>;
  public apiKey: ApiKey = emptyApiKey();

  private onDestroy: Subject<void> = new Subject<void>();

  private ownablePolicies: Policy[] = [];
  private ownedPolicies: Policy[] = [];
  private allPolicies: Policy[] = [];
  public viewState: "meta" | "policy" = "meta";

  constructor(
    private router: Router,
    private activatedRoute: ActivatedRoute,
    private apiKeyService: ApiKeyService,
    private policyService: PolicyService,
    private passportService: PassportService
  ) {}

  ngOnInit() {
    this.activatedRoute.params
      .pipe(
        filter(params => params.id),
        switchMap(params => this.apiKeyService.get(params.id)),
        tap(apiKey => (this.apiKey = apiKey)),
        switchMapTo(
          this.passportService
            .checkAllowed("passport:policy:index")
            .pipe(switchMap(result => (result ? this.policyService.find() : of({data: []}))))
        ),
        tap(policies => {
          this.allPolicies = policies.data;
          this.filterPolicies(this.allPolicies);
        }),
        takeUntil(this.onDestroy)
      )
      .subscribe();
  }

  filterPolicies(policies: Policy[]) {
    this.ownedPolicies = [];
    this.ownablePolicies = [];
    policies.forEach(policy => {
      this.apiKey.policies.includes(policy._id)
        ? this.ownedPolicies.push(policy)
        : this.ownablePolicies.push(policy);
    });
  }

  saveApiKey() {
    this.apiKey._id
      ? this.apiKeyService
          .replaceOne(this.apiKey)
          .toPromise()
          .then(() => this.router.navigate(["passport/apikey"]))
      : this.apiKeyService
          .insertOne(this.apiKey)
          .toPromise()
          .then(apikey => this.router.navigate(["passport/apikey", apikey._id, "edit"]));
  }

  attachPolicy(policyId: string) {
    this.apiKeyService
      .attachPolicy(policyId, this.apiKey._id)
      .toPromise()
      .then(apiKey => {
        this.apiKey = apiKey;
        this.filterPolicies(this.allPolicies);
      });
  }

  detachPolicy(policyId: string) {
    this.apiKeyService
      .detachPolicy(policyId, this.apiKey._id)
      .toPromise()
      .then(apiKey => {
        this.apiKey = apiKey;
        this.filterPolicies(this.allPolicies);
      });
  }

  ngOnDestroy() {
    this.onDestroy.next();
  }
}
