import {Injectable} from "@angular/core";
import {MatDialog} from "@angular/material/dialog";
import {ActivatedRouteSnapshot, CanDeactivate, RouterStateSnapshot, UrlTree} from "@angular/router";
import {SaveChangesComponent, SaveChangesDecision} from "@spica-client/common/save-changes";
import {Observable, of} from "rxjs";
import {first, map, switchMap, tap} from "rxjs/operators";
import {emptyBucket} from "../interfaces/bucket";
import {AddComponent} from "../pages/add/add.component";
import {BucketAddComponent} from "../pages/bucket-add/bucket-add.component";
import {BucketDataService} from "../services/bucket-data.service";
import {BucketService} from "../services/bucket.service";
import isEqual from "lodash/isEqual";

@Injectable()
export class BucketCanDeactivate implements CanDeactivate<BucketAddComponent> {
  constructor(private bucketService: BucketService, public matDialog: MatDialog) {}

  canDeactivate(
    component: BucketAddComponent,
    currentRoute: ActivatedRouteSnapshot,
    currentState: RouterStateSnapshot,
    nextState: RouterStateSnapshot
  ): Observable<boolean | UrlTree> | Promise<boolean | UrlTree> | boolean | UrlTree {
    const bucketWithChanges = component.bucket;
    const initialBucket = emptyBucket();

    if (equals(bucketWithChanges, initialBucket)) {
      return true;
    }

    let sourceObs: Observable<SaveChangesDecision>;

    if (!bucketWithChanges._id) {
      sourceObs = this.matDialog.open(SaveChangesComponent).afterClosed();
    } else {
      sourceObs = this.bucketService.getBucket(bucketWithChanges._id).pipe(
        map(existingBucket => equals(existingBucket, bucketWithChanges)),
        switchMap(isEqual => {
          if (isEqual) {
            return of(SaveChangesDecision.UNSAVE);
          }

          return this.matDialog.open(SaveChangesComponent).afterClosed();
        })
      );
    }

    return sourceObs.pipe(
      switchMap(res => {
        if (res == SaveChangesDecision.SAVE) {
          return component
            .getSaveObservable(false)
            .toPromise()
            .then(() => true)
            .catch(() => false);
        } else if (res == SaveChangesDecision.UNSAVE) {
          return of(true);
        } else if (res == SaveChangesDecision.CANCEL) {
          return of(false);
        }
        // default
        return of(true);
      })
    );
  }
}

@Injectable()
export class BucketDataCanDeactivate implements CanDeactivate<AddComponent> {
  constructor(private bucketDataService: BucketDataService, public matDialog: MatDialog) {}

  canDeactivate(
    component: AddComponent,
    currentRoute: ActivatedRouteSnapshot,
    currentState: RouterStateSnapshot,
    nextState: RouterStateSnapshot
  ): Observable<boolean | UrlTree> | Promise<boolean | UrlTree> | boolean | UrlTree {
    const bucketDataWithChanges = component.data;
    const initialData = {};

    if (equals(bucketDataWithChanges, initialData)) {
      return true;
    }

    let sourceObs: Observable<SaveChangesDecision>;

    if (!bucketDataWithChanges._id) {
      sourceObs = this.matDialog.open(SaveChangesComponent).afterClosed();
    } else {
      sourceObs = this.bucketDataService
        .findOne(component.bucketId, bucketDataWithChanges._id)
        .pipe(
          first(),
          map(existingData => equals(existingData, bucketDataWithChanges)),
          switchMap(isEqual => {
            if (isEqual) {
              return of(SaveChangesDecision.UNSAVE);
            }

            return this.matDialog.open(SaveChangesComponent).afterClosed();
          })
        );
    }

    return sourceObs.pipe(
      switchMap(res => {
        if (res == SaveChangesDecision.SAVE) {
          return component
            .getSaveObservable(false)
            .toPromise()
            .then(() => true)
            .catch(() => false);
        } else if (res == SaveChangesDecision.UNSAVE) {
          return of(true);
        } else if (res == SaveChangesDecision.CANCEL) {
          return of(false);
        }
        // default
        return of(true);
      })
    );
  }
}

function equals(previous: any, current: any) {
  return isEqual(previous, current);
}
