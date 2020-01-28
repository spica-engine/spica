import {Component, OnInit, TemplateRef, ViewChild, OnDestroy} from "@angular/core";
import {ApiKey, emptyApiKey} from "src/passport/interfaces/apikey";
import {Router, ActivatedRoute} from "@angular/router";
import {filter, switchMap, takeUntil, tap} from "rxjs/operators";
import {ApiKeyService} from "src/passport/services/apikey.service";
import {Subject} from "rxjs";
import {Policy} from "src/passport/interfaces/policy";
import {PolicyService} from "src/passport/services/policy.service";

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

  constructor(
    private router: Router,
    private activatedRoute: ActivatedRoute,
    private apiKeyService: ApiKeyService,
    private policyService: PolicyService
  ) {}

  ngOnInit() {
    this.activatedRoute.params
      .pipe(
        filter(params => params.id),
        switchMap(params => this.apiKeyService.get(params.id)),
        takeUntil(this.onDestroy)
      )
      .subscribe(apiKey => {
        this.apiKey = apiKey;
        this.policyService
          .find()
          .toPromise()
          .then(policies => {
            this.allPolicies = policies.data;
            this.filterPolicies(this.allPolicies);
          });
      });
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
          .update(this.apiKey)
          .toPromise()
          .then(() => this.router.navigate(["passport/apikey"]))
      : this.apiKeyService
          .insert(this.apiKey)
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
