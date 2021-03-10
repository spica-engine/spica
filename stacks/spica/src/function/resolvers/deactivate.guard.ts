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
import {AddComponent} from "../pages/add/add.component";
import isEqual from "lodash/isEqual";
import {MatAwareDialogComponent} from "@spica-client/material";
import {FunctionService} from "../function.service";
import {emptyFunction, normalizeFunction} from "../interface";

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
    // const indexWithChanges = component.index;

    let initialFn = emptyFunction();
    // initialFn = component.prepareToShow(initialFn);
    // const initialIndex = undefined;

    if (isEqual(fnWithChanges, initialFn)) {
      return true;
    }

    if (fnWithChanges._id) {
      return this.functionService.getFunction(fnWithChanges._id).pipe(
        first(),
        // map(fn => component.prepareToShow(fn)),
        tap(fn => console.log(fn, fnWithChanges)),
        switchMap(existingFn => (isEqual(existingFn, fnWithChanges) ? of(true) : this.openDialog()))
      );
    }

    return this.openDialog();
  }
}
