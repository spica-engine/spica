import {Component, OnDestroy, OnInit, TemplateRef, ViewChild} from "@angular/core";
import {ActivatedRoute, Router} from "@angular/router";
import {PreferencesService} from "@spica-client/core";
import {Subject} from "rxjs";
import {filter, switchMap, takeUntil} from "rxjs/operators";
import {emptyIdentity, Identity} from "../../interfaces/identity";
import {Policy} from "../../interfaces/policy";
import {IdentityService} from "../../services/identity.service";
import {PolicyService} from "../../services/policy.service";
import {PassportPreference} from "../identity-settings/identity-settings.component";

@Component({
  selector: "passport-identity-add",
  templateUrl: "./identity-add.component.html",
  styleUrls: ["./identity-add.component.scss"]
})
export class IdentityAddComponent implements OnInit, OnDestroy {
  @ViewChild("toolbar", {static: true}) toolbar: TemplateRef<any>;
  identity: Identity = emptyIdentity();
  policies: Policy[];
  changePasswordState: boolean;

  public error: string;
  public preferences: PassportPreference;
  private onDestroy: Subject<void> = new Subject<void>();

  constructor(
    private activatedRoute: ActivatedRoute,
    private policyService: PolicyService,
    private identityService: IdentityService,
    private preferencesService: PreferencesService,
    private router: Router
  ) {}

  get ownedPolicies(): Policy[] {
    try {
      return this.policies.filter(policy => this.identity.policies.includes(policy._id));
    } catch {
      return Array();
    }
  }

  ngOnInit() {
    this.activatedRoute.params
      .pipe(
        filter(params => params.id),
        switchMap(params => this.identityService.findOne(params.id)),
        takeUntil(this.onDestroy)
      )
      .subscribe(identity => (this.identity = identity));

    this.policyService
      .find()
      .toPromise()
      .then(policies => {
        this.policies = policies.data;
      });

    this.preferencesService
      .get("passport")
      .toPromise()
      .then(pref => {
        this.preferences = pref.identity;
      });
  }

  attachPolicy(policyId: string) {
    this.policyService
      .attachPolicy(policyId, this.identity._id)
      .toPromise()
      .then(identity => {
        this.identity = identity;
      });
  }

  detachPolicy(policyId: string) {
    this.policyService
      .detachPolicy(policyId, this.identity._id)
      .toPromise()
      .then(identity => {
        this.identity = identity;
      });
  }

  upsertIdentity(): void {
    if (this.identity._id) {
      this.identityService
        .updateOne(this.identity)
        .toPromise()
        .then(() => this.router.navigate(["passport/identity"]));
    } else {
      this.identityService
        .insertOne(this.identity)
        .toPromise()
        .then(
          identity => {
            this.identity = identity;
            this.router.navigate(["passport", "identities", identity._id, "edit"]);
          },
          error => (this.error = error)
        );
    }
  }

  ngOnDestroy(): void {
    this.onDestroy.next();
  }
}
