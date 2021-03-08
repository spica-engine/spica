import {Component, Injectable, NgModule} from "@angular/core";
import {MatDialog} from "@angular/material/dialog";
import {
  ActivatedRouteSnapshot,
  CanDeactivate,
  RouterModule,
  RouterStateSnapshot,
  Routes,
  UrlTree
} from "@angular/router";
import {Route, RouteCategory, RouteModule} from "@spica-client/core";
import {MatAwareDialogComponent} from "@spica-client/material";
import {Observable, of} from "rxjs";
import {map} from "rxjs/internal/operators/map";
import {
  catchError,
  concatMap,
  debounceTime,
  defaultIfEmpty,
  filter,
  first,
  flatMap,
  ignoreElements,
  mergeMap,
  retryWhen,
  skip,
  switchMap,
  takeUntil,
  takeWhile,
  tap,
  withLatestFrom
} from "rxjs/operators";
import {IdentityGuard, PolicyGuard} from "../passport";
import {AddComponent} from "./pages/add/add.component";
import {BucketAddComponent} from "./pages/bucket-add/bucket-add.component";
import {BucketIndexComponent} from "./pages/bucket-index/bucket-index.component";
import {IndexComponent} from "./pages/index/index.component";
import {SaveChangesComponent} from "./pages/save-changes/save-changes.component";
import {SettingsComponent} from "./pages/settings/settings.component";
import {WelcomeComponent} from "./pages/welcome/welcome.component";
import {BucketService} from "./services/bucket.service";
import {BucketIndexGuard} from "./state/index.guard";

@Injectable()
class CanDeactivateTeam implements CanDeactivate<any> {
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
              return component.saveBucket(false).pipe(
                catchError(() => of(false)),
                map(res => !!res)
              );
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
                  return component.saveBucket(false).pipe(
                    catchError(() => of(false)),
                    map(res => !!res)
                  );
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

const routes: Routes = [
  {
    path: "bucket",
    canActivateChild: [IdentityGuard, PolicyGuard],
    data: {
      service: "bucket:data"
    },
    children: [
      {
        path: ":id",
        component: IndexComponent,
        data: {
          action: "index"
        }
      },
      {
        path: ":id/add",
        component: AddComponent,
        data: {
          action: "create"
        }
      },
      {
        path: ":id/:rid",
        component: AddComponent,
        data: {
          action: "show"
        }
      }
    ]
  },
  {
    path: "buckets",
    canActivateChild: [IdentityGuard, PolicyGuard],
    data: {
      service: "bucket"
    },
    children: [
      {
        path: "welcome",
        component: WelcomeComponent
      },
      {
        path: "settings",
        component: SettingsComponent,
        data: {
          service: "preference",
          action: "show",
          params: {
            scope: "bucket"
          }
        }
      },
      {
        canActivate: [BucketIndexGuard],
        path: "",
        component: BucketIndexComponent,
        data: {
          action: "index"
        }
      },
      {
        path: "add",
        component: BucketAddComponent,
        data: {
          action: "create"
        },
        canDeactivate: [CanDeactivateTeam]
      },
      {
        path: ":id",
        component: BucketAddComponent,
        data: {
          action: "show"
        },
        canDeactivate: [CanDeactivateTeam]
      }
    ]
  }
];

const route: Route[] = [
  {
    id: "bucket",
    category: RouteCategory.Content_Sub,
    icon: "view_day",
    path: "/buckets",
    display: "Buckets",
    data: {
      action: "bucket:index"
    }
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes), RouteModule.forChild(route)],
  exports: [RouterModule, RouteModule],
  providers: [CanDeactivateTeam]
})
export class BucketRoutingModule {}
