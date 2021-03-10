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
import {first, map, switchMap} from "rxjs/operators";
import {AddComponent} from "../pages/add/add.component";
import isEqual from "lodash/isEqual";
import {MatAwareDialogComponent} from "@spica-client/material";
import {FunctionService} from "../function.service";
import {emptyFunction, emptyWebhook, normalizeFunction} from "../interface";
import {WebhookAddComponent} from "../pages/webhook-add/webhook-add.component";
import {WebhookService} from "../webhook.service";

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
export class FunctionCanDeactivate implements CanDeactivate<AddComponent> {
  constructor(
    private router: Router,
    private functionService: FunctionService,
    public matDialog: MatDialog
  ) {}

  openDialog() {
    return this.matDialog
      .open(MatAwareDialogComponent, {
        data: awareDialogData
      })
      .afterClosed();
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

    const fnWithChanges = component.function;
    const indexWithChanges = component.index;

    if (fnWithChanges._id) {
      return this.functionService.getFunction(fnWithChanges._id).pipe(
        map(existingFn => normalizeFunction(existingFn)),
        switchMap(existingFn =>
          this.functionService.getIndex(existingFn._id).pipe(
            map(existingIndex => {
              return {existingFn, existingIndex};
            })
          )
        ),
        map(
          ({existingFn, existingIndex}) =>
            isEqual(existingFn, fnWithChanges) && isEqual(existingIndex.index, indexWithChanges)
        ),
        switchMap(isEqual => (isEqual ? of(true) : this.openDialog()))
      );
    } else {
      const initialFn = emptyFunction();

      return this.functionService.information().pipe(
        map(information => {
          initialFn.timeout = initialFn.timeout || information.timeout * 0.7;

          for (const [key, value] of Object.entries(information.enqueuers[0].options.properties)) {
            initialFn.triggers[0].options[key] = value["default"];
          }
        }),
        switchMap(() => {
          return isEqual(initialFn, fnWithChanges) &&
            (isEqual(indexWithChanges, undefined) || isEqual(indexWithChanges, ""))
            ? of(true)
            : this.openDialog();
        })
      );
    }
  }
}

@Injectable()
export class WebhookCanDeactivate implements CanDeactivate<WebhookAddComponent> {
  constructor(
    private router: Router,
    private webhookService: WebhookService,
    public matDialog: MatDialog
  ) {}

  openDialog() {
    return this.matDialog
      .open(MatAwareDialogComponent, {
        data: awareDialogData
      })
      .afterClosed();
  }

  canDeactivate(
    component: WebhookAddComponent,
    currentRoute: ActivatedRouteSnapshot,
    currentState: RouterStateSnapshot,
    nextState: RouterStateSnapshot
  ): Observable<boolean | UrlTree> | Promise<boolean | UrlTree> | boolean | UrlTree {
    const state = this.router.getCurrentNavigation().extras.state;

    if (state && state.skipSaveChanges) {
      return true;
    }

    const webhookWithChanges = component.webhook;

    const initialWebhook = emptyWebhook();

    if (isEqual(webhookWithChanges, initialWebhook)) {
      return true;
    }

    if (webhookWithChanges._id) {
      return this.webhookService.get(webhookWithChanges._id).pipe(
        first(),
        switchMap(existingWebhook =>
          isEqual(existingWebhook, webhookWithChanges) ? of(true) : this.openDialog()
        )
      );
    }

    return this.openDialog();
  }
}
