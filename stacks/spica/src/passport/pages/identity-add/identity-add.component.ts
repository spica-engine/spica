import {Location} from "@angular/common";
import {Component, OnDestroy, OnInit} from "@angular/core";
import {ActivatedRoute, Router} from "@angular/router";
import {PreferencesService} from "@spica-client/core";
import {Subject} from "rxjs";
import {filter, switchMap, takeUntil} from "rxjs/operators";
import {EMPTY_IDENTITY, Identity} from "../../interfaces/identity";
import {Policy} from "../../interfaces/policy";
import {PolicyService} from "../../services/policy.service";
import {IdentityService} from "../../services/identity.service";

@Component({
  selector: "passport-identity-add",
  templateUrl: "./identity-add.component.html",
  styleUrls: ["./identity-add.component.scss"]
})
export class IdentityAddComponent implements OnInit, OnDestroy {
  identity: Identity = {...EMPTY_IDENTITY};
  policies: Policy[];
  changePasswordState: boolean;

  public error;
  public customAttributes;
  private onDestroy: Subject<void> = new Subject<void>();

  constructor(
    private activatedRoute: ActivatedRoute,
    private policyService: PolicyService,
    private identityService: IdentityService,
    private preferencesService: PreferencesService,
    private location: Location,
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
        takeUntil(this.onDestroy),
        switchMap(params => this.identityService.findOne(params.id))
      )
      .subscribe(identity => {
        this.identity = {...EMPTY_IDENTITY, ...identity};
      });

    this.policyService
      .find()
      .toPromise()
      .then(policies => {
        this.policies = policies.data;
      });

    this.preferencesService
      .get("passport")
      .toPromise()
      .then(data => {
        this.customAttributes = data.identity.custom_attributes;
      });
  }

  attachPolicy(policyId: string) {
    this.policyService
      .attachPolicy(policyId, this.identity._id)
      .toPromise()
      .then(identityData => {
        this.identity = identityData;
      });
  }

  detachPolicy(policyId: string) {
    this.policyService
      .detachPolicy(policyId, this.identity._id)
      .toPromise()
      .then(identityData => {
        this.identity = identityData;
      });
  }

  createIdentity(): void {
    this.identityService
      .insertOne(this.identity)
      .toPromise()
      .then(
        i => {
          this.identity = i;
          this.location.replaceState(`passport/identities/${i._id}/edit`);
        },
        error => {
          this.error = error;
        }
      );
  }

  updateIdentity(): void {
    this.identityService
      .updateOne(this.identity)
      .toPromise()
      .then(() => this.router.navigate(["passport/identities"]));
  }

  submitForm(): void {
    if (this.identity._id) {
      this.updateIdentity();
    } else {
      this.createIdentity();
    }
  }

  ngOnDestroy(): void {
    this.onDestroy.next();
  }
}
