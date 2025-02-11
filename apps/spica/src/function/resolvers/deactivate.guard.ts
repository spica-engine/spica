import {Injectable} from "@angular/core";
import {MatDialog} from "@angular/material/dialog";
import {CanDeactivate, UrlTree} from "@angular/router";
import {Observable} from "rxjs";
import {first} from "rxjs/operators";
import {AddComponent} from "../pages/add/add.component";
import {MatAwareDialogComponent} from "@spica-client/material";

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
  constructor(public matDialog: MatDialog) {}

  openDialog() {
    return this.matDialog
      .open(MatAwareDialogComponent, {
        data: awareDialogData
      })
      .afterClosed()
      .pipe(first());
  }

  canDeactivate(
    component: AddComponent
  ): Observable<boolean | UrlTree> | Promise<boolean | UrlTree> | boolean | UrlTree {
    return component.hasUnsavedChanges() ? this.openDialog() : true;
  }
}
