import {Injectable} from "@angular/core";
import {MatDialog} from "@angular/material/dialog";
import {ActivatedRouteSnapshot, CanDeactivate, RouterStateSnapshot, UrlTree} from "@angular/router";
import {SaveChangesComponent} from "@spica-client/common/save-changes";
import {Observable, of} from "rxjs";
import {first, map, switchMap} from "rxjs/operators";
import {BucketAddComponent} from "../pages/bucket-add/bucket-add.component";
import {BucketService} from "../services/bucket.service";

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

    if (!bucketWithChanges._id) {
      return this.matDialog
        .open(SaveChangesComponent)
        .afterClosed()
        .pipe(
          switchMap(res => {
            if (res == "save") {
              // @TODO: find a listen this observable response
              return component
                .saveBucket(false)
                .toPromise()
                .then(() => true)
                .catch(e => false);
            } else if (res == "cancel") {
              return of(false);
            } else if (res == "unsave") {
              return of(true);
            }
          })
        );
    }

    return this.bucketService.getBucket(bucketWithChanges._id).pipe(
      first(),
      map(existingBucket => {
        if (JSON.stringify(existingBucket) == JSON.stringify(bucketWithChanges)) {
          return false;
        } else {
          return true;
        }
      }),
      switchMap(hasChange => {
        if (!hasChange) {
          return of(true);
        } else {
          return this.matDialog
            .open(SaveChangesComponent)
            .afterClosed()
            .pipe(
              switchMap(res => {
                if (res == "save") {
                  // @TODO: find a listen this observable response
                  return component
                    .saveBucket(false)
                    .toPromise()
                    .then(() => true)
                    .catch(e => false);
                } else if (res == "cancel") {
                  return of(false);
                } else if (res == "unsave") {
                  return of(true);
                }
              })
            );
        }
      })
    );
  }
}
