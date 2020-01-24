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

  constructor(
    private router: Router,
    private activatedRoute: ActivatedRoute,
    private apiKeyService: ApiKeyService,
    private policyService: PolicyService
  ) {}

  ngOnInit() {
    this.filterPolicies();

    this.activatedRoute.params
      .pipe(
        filter(params => params.id),
        switchMap(params => this.apiKeyService.get(params.id)),
        takeUntil(this.onDestroy)
      )
      .subscribe(apiKey => {
        this.apiKey = apiKey;
        this.filterPolicies();
      });
  }

  filterPolicies() {
    this.policyService
      .find()
      .toPromise()
      .then(policies => {
        policies.data.forEach(policy => {
          this.pushToCategory(policy);
        });
      });
  }

  pushToCategory(policy: Policy) {
    this.apiKey.policies.includes(policy._id)
      ? this.ownedPolicies.push(policy)
      : this.ownablePolicies.push(policy);
  }

  saveApiKey() {
    (this.apiKey._id
      ? this.apiKeyService.update(this.apiKey)
      : this.apiKeyService.insert(this.apiKey)
    )
      .toPromise()
      .then(() => this.router.navigate(["passport/apikey"]));
  }

  attachPolicy(policy: Policy) {
    this.ownablePolicies = this.ownablePolicies.filter(item => item._id != policy._id);
    this.ownedPolicies.push(policy);
  }

  detachPolicy(policy: Policy) {
    this.ownedPolicies = this.ownedPolicies.filter(item => item._id != policy._id);
    this.ownablePolicies.push(policy);
  }

  ngOnDestroy() {
    this.onDestroy.next();
  }
}
