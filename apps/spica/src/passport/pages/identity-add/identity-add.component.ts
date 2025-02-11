import {Component, OnDestroy, OnInit, TemplateRef, ViewChild} from "@angular/core";
import {ActivatedRoute, Router} from "@angular/router";
import {PreferencesService} from "@spica-client/core";
import {Subject, of} from "rxjs";
import {filter, map, switchMap, takeUntil, tap} from "rxjs/operators";
import {
  AuthFactorSchema,
  emptyAuthFactor,
  emptyIdentity,
  Identity
} from "../../interfaces/identity";
import {Policy} from "../../interfaces/policy";
import {IdentityService} from "../../services/identity.service";
import {PolicyService} from "../../services/policy.service";
import {PassportService} from "@spica-client/passport/services/passport.service";
import {PassportPreference} from "@spica-client/passport/interfaces/preferences";

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

  authFactorSchemas: AuthFactorSchema[] = [];
  selectedAuthFactor;
  authFactorChallenge;
  verificationResponse;
  viewState: string = "meta";
  public error: string;
  public preferences: PassportPreference;
  private onDestroy: Subject<void> = new Subject<void>();

  constructor(
    private activatedRoute: ActivatedRoute,
    private policyService: PolicyService,
    private identityService: IdentityService,
    private preferencesService: PreferencesService,
    private passportService: PassportService,
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
        switchMap(identity =>
          this.identityService.getAuthFactorSchemas().pipe(
            map(schemas => {
              return {
                schemas,
                identity
              };
            })
          )
        ),
        takeUntil(this.onDestroy)
      )
      .subscribe(({schemas, identity}) => {
        this.identity = identity;
        this.authFactorSchemas = schemas;
      });

    this.passportService
      .checkAllowed("passport:policy:index")
      .pipe(
        switchMap(result => (result ? this.policyService.find() : of({data: []}))),
        tap(policies => (this.policies = policies.data)),
        takeUntil(this.onDestroy)
      )
      .subscribe();

    // in order to prevent getting 403 when there is missing preference show policy on passport resource
    this.passportService
      .checkAllowed("preference:show", "passport")
      .toPromise()
      .then(isAllowed => {
        isAllowed &&
          this.preferencesService
            .get("passport")
            .toPromise()
            .then(pref => {
              this.preferences = pref.identity;
            });
      });
  }

  attachPolicy(policyId: string) {
    this.policyService
      .attachPolicy(policyId, this.identity._id)
      .toPromise()
      .then(() => {
        this.identity.policies.push(policyId);
      });
  }

  detachPolicy(policyId: string) {
    this.policyService
      .detachPolicy(policyId, this.identity._id)
      .toPromise()
      .then(() => {
        const detachedPolicyIndex = this.identity.policies.findIndex(policy => policy == policyId);
        if (detachedPolicyIndex != -1) {
          this.identity.policies.splice(detachedPolicyIndex, 1);
        }
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
        .then(identity => {
          delete identity.password;
          this.error = undefined;
          this.identity = identity;
          this.router.navigate(["passport", "identity", identity._id, "edit"]);
        })
        .catch(err => (this.error = err.error.message));
    }
  }

  switch2FA(isEnabled: boolean) {
    if (isEnabled) {
      this.selectedAuthFactor = emptyAuthFactor();
    } else {
      if (this.identity.authFactor) {
        this.identityService.removeAuthFactor(this.identity._id).toPromise();
        this.identity.authFactor = undefined;
      }
      this.selectedAuthFactor = undefined;
      this.authFactorChallenge = undefined;
    }
  }

  on2FAMethodChange(selection: string) {
    const selectedFactor = this.authFactorSchemas.find(s => s.type == selection);
    this.selectedAuthFactor = JSON.parse(JSON.stringify(selectedFactor));

    Object.keys(selectedFactor.config).forEach(key => {
      this.selectedAuthFactor.config[key] = undefined;
    });

    this.authFactorChallenge = undefined;
  }

  getAuthFactorSchema(type: string) {
    return this.authFactorSchemas.find(s => s.type == type);
  }

  async startVerification() {
    this.authFactorChallenge = await this.identityService
      .startAuthFactorVerification(this.identity._id, this.selectedAuthFactor)
      .toPromise();
  }

  async completeVerification(answer) {
    const isVerified = await this.identityService
      .completeAuthFactorVerification(this.identity._id, answer)
      .toPromise();

    if (isVerified) {
      this.verificationResponse = "Verification has been completed successfully.";
      this.identity.authFactor = JSON.parse(JSON.stringify(this.selectedAuthFactor));
      this.selectedAuthFactor = undefined;
    }

    this.authFactorChallenge = undefined;

    setTimeout(() => {
      this.verificationResponse = "";
    }, 5000);
  }

  ngOnDestroy(): void {
    this.onDestroy.next();
  }
}
