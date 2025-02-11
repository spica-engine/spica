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
import {emptyBucket} from "../interfaces/bucket";
import {AddComponent} from "../pages/add/add.component";
import {BucketDataService} from "../services/bucket-data.service";
import {BucketService} from "../services/bucket.service";
import isEqual from "lodash-es/isEqual";
import {MatAwareDialogComponent} from "@spica-client/material";
import {SettingsComponent} from "../pages/settings/settings.component";
import {PreferencesService} from "@spica-client/core";
import {BucketSettings} from "../interfaces/bucket-settings";

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
export class BucketDataCanDeactivate implements CanDeactivate<AddComponent> {
  constructor(
    private bucketDataService: BucketDataService,
    private router: Router,
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
    component: AddComponent,
    currentRoute: ActivatedRouteSnapshot,
    currentState: RouterStateSnapshot,
    nextState: RouterStateSnapshot
  ): Observable<boolean | UrlTree> | Promise<boolean | UrlTree> | boolean | UrlTree {
    const state = this.router.getCurrentNavigation().extras.state;

    if (state && state.skipSaveChanges) {
      return true;
    }

    const dataWithChanges = component.data;
    const initialData = {};

    if (isEqual(dataWithChanges, initialData)) {
      return true;
    }

    if (dataWithChanges._id) {
      return this.bucketDataService.findOne(component.bucketId, dataWithChanges._id).pipe(
        first(),
        switchMap(existingData =>
          isEqual(existingData, dataWithChanges) ? of(true) : this.openDialog()
        )
      );
    }

    return this.openDialog();
  }
}

@Injectable()
export class BucketSettingsCanDeactivate implements CanDeactivate<SettingsComponent> {
  constructor(
    private preferenceService: PreferencesService,
    private router: Router,
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
    component: SettingsComponent,
    currentRoute: ActivatedRouteSnapshot,
    currentState: RouterStateSnapshot,
    nextState: RouterStateSnapshot
  ): Observable<boolean | UrlTree> | Promise<boolean | UrlTree> | boolean | UrlTree {
    const state = this.router.getCurrentNavigation().extras.state;

    if (state && state.skipSaveChanges) {
      return true;
    }

    return this.preferenceService.get<BucketSettings>("bucket").pipe(
      first(),
      switchMap(prefs => (isEqual(prefs, component.settings) ? of(true) : this.openDialog()))
    );
  }
}
