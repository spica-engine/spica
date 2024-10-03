import {Injectable} from "@angular/core";
import {MatDialog} from "@angular/material/dialog";
import {
  ActivatedRouteSnapshot,
  CanDeactivate,
  Router,
  RouterStateSnapshot,
  UrlTree
} from "@angular/router";
import {Observable, of} from "rxjs";
import {first, map, switchMap, tap} from "rxjs/operators";
import isEqual from "lodash-es/isEqual";
import {ApiKeyService} from "../services/apikey.service";
import {ApiKeyAddComponent} from "../pages/apikey-add/apikey-add.component";
import {MatAwareDialogComponent} from "@spica-client/material";
import {emptyApiKey} from "../interfaces/apikey";
import {IdentityService} from "./identity.service";
import {emptyIdentity} from "../interfaces/identity";
import {IdentityAddComponent} from "../pages/identity-add/identity-add.component";
import {PolicyAddComponent} from "../pages/policy-add/policy-add.component";
import {PolicyService} from "./policy.service";
import {emptyPolicy} from "../interfaces/policy";
import {deepCopy, PreferencesService} from "@spica-client/core";
import {IdentitySettingsComponent} from "../pages/identity-settings/identity-settings.component";
import {PassportPreference} from "../interfaces/preferences";

const awareDialogData = {
  icon: "help",
  title: "Confirmation",
  templateOrDescription:
    "You have unsaved changes and they will be lost if you continue without save them.",
  answer: "",
  confirmText: "Continue without save",
  cancelText: "Cancel",
  noAnswer: true
};

@Injectable()
export class ApiKeyCanDeactivate implements CanDeactivate<ApiKeyAddComponent> {
  constructor(
    private router: Router,
    private apikeyService: ApiKeyService,
    public matDialog: MatDialog
  ) {}

  openDialog() {
    return this.matDialog
      .open(MatAwareDialogComponent, {
        data: awareDialogData
      })
      .afterClosed()
      .pipe(first());
  }

  canDeactivate(
    component: ApiKeyAddComponent,
    currentRoute: ActivatedRouteSnapshot,
    currentState: RouterStateSnapshot,
    nextState: RouterStateSnapshot
  ): Observable<boolean | UrlTree> | Promise<boolean | UrlTree> | boolean | UrlTree {
    const state = this.router.getCurrentNavigation().extras.state;

    if (state && state.skipSaveChanges) {
      return true;
    }

    const apikeyWithChanges = component.apiKey;
    const initialApikey = emptyApiKey();

    if (isEqual(apikeyWithChanges, initialApikey)) {
      return true;
    }

    if (apikeyWithChanges._id) {
      return this.apikeyService.get(apikeyWithChanges._id).pipe(
        first(),
        switchMap(existingApikey =>
          isEqual(existingApikey, apikeyWithChanges) ? of(true) : this.openDialog()
        )
      );
    }

    return this.openDialog();
  }
}

@Injectable()
export class IdentityCanDeactivate implements CanDeactivate<IdentityAddComponent> {
  constructor(
    private router: Router,
    private identityService: IdentityService,
    public matDialog: MatDialog
  ) {}

  openDialog() {
    return this.matDialog
      .open(MatAwareDialogComponent, {
        data: awareDialogData
      })
      .afterClosed()
      .pipe(first());
  }

  canDeactivate(
    component: IdentityAddComponent,
    currentRoute: ActivatedRouteSnapshot,
    currentState: RouterStateSnapshot,
    nextState: RouterStateSnapshot
  ): Observable<boolean | UrlTree> | Promise<boolean | UrlTree> | boolean | UrlTree {
    const state = this.router.getCurrentNavigation().extras.state;

    if (state && state.skipSaveChanges) {
      return true;
    }

    const identityWithChanges = component.identity;
    const initialIdentity = emptyIdentity();

    if (isEqual(identityWithChanges, initialIdentity)) {
      return true;
    }

    if (identityWithChanges._id) {
      return this.identityService.findOne(identityWithChanges._id).pipe(
        first(),
        switchMap(existingIdentity =>
          isEqual(existingIdentity, identityWithChanges) ? of(true) : this.openDialog()
        )
      );
    }

    return this.openDialog();
  }
}

@Injectable()
export class PolicyCanDeactivate implements CanDeactivate<PolicyAddComponent> {
  constructor(
    private router: Router,
    private policyService: PolicyService,
    public matDialog: MatDialog
  ) {}

  openDialog() {
    return this.matDialog
      .open(MatAwareDialogComponent, {
        data: awareDialogData
      })
      .afterClosed()
      .pipe(first());
  }

  canDeactivate(
    component: PolicyAddComponent,
    currentRoute: ActivatedRouteSnapshot,
    currentState: RouterStateSnapshot,
    nextState: RouterStateSnapshot
  ): Observable<boolean | UrlTree> | Promise<boolean | UrlTree> | boolean | UrlTree {
    const state = this.router.getCurrentNavigation().extras.state;

    if (state && state.skipSaveChanges) {
      return true;
    }

    const policyWithChanges = component.originalPolicy;
    policyWithChanges.statement = component.prepareToSave(component.displayedStatements);

    const initialPolicy = emptyPolicy();

    if (isEqual(policyWithChanges, initialPolicy)) {
      return true;
    }

    if (policyWithChanges._id) {
      return this.policyService.findOne(policyWithChanges._id).pipe(
        first(),
        switchMap(existingPolicy =>
          isEqual(existingPolicy, policyWithChanges) ? of(true) : this.openDialog()
        )
      );
    }

    return this.openDialog();
  }
}

@Injectable()
export class SettingsCanDeactivate implements CanDeactivate<IdentitySettingsComponent> {
  constructor(
    private router: Router,
    private preferenceService: PreferencesService,
    public matDialog: MatDialog
  ) {}

  openDialog() {
    return this.matDialog
      .open(MatAwareDialogComponent, {
        data: awareDialogData
      })
      .afterClosed()
      .pipe(first());
  }

  canDeactivate(
    component: IdentitySettingsComponent,
    currentRoute: ActivatedRouteSnapshot,
    currentState: RouterStateSnapshot,
    nextState: RouterStateSnapshot
  ): Observable<boolean | UrlTree> | Promise<boolean | UrlTree> | boolean | UrlTree {
    const state = this.router.getCurrentNavigation().extras.state;

    if (state && state.skipSaveChanges) {
      return true;
    }

    return this.preferenceService.get<PassportPreference>("passport").pipe(
      first(),
      map(prefs => {
        prefs.identity.attributes.properties = prefs.identity.attributes.properties || {};
        return prefs;
      }),
      switchMap(prefs => (isEqual(prefs, component.preferences) ? of(true) : this.openDialog()))
    );
  }
}
