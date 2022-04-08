import {Component} from "@angular/core";
import {VersionControlService} from "@spica-client/dashboard/services/versioncontrol.service";
import {BehaviorSubject, of} from "rxjs";
import {switchMap, tap} from "rxjs/operators";

@Component({
  selector: "versioncontrol",
  templateUrl: "./versioncontrol.component.html",
  styleUrls: ["./versioncontrol.component.scss"]
})
export class VersionControlComponent {
  lastSave$ = of();
  commands$ = of({});

  refresh$ = new BehaviorSubject("");

  selectedCmd;
  body = {};
  response;

  isPending = false;

  constructor(private vcs: VersionControlService) {
    this.lastSave$ = this.refresh$.pipe(switchMap(() => this.vcs.getLastSave()));
    this.commands$ = this.vcs.getCommands();
  }

  save() {
    return this.vcs
      .save()
      .pipe(tap(() => this.refresh$.next("")))
      .toPromise();
  }

  onBodyChange(field, definition, value: string) {
    let preparedValue;

    if (definition.type == "array") {
      preparedValue = value != "" ? value.split(" ") : [];
    } else {
      preparedValue = value;
    }

    if (!preparedValue || !preparedValue.length) {
      delete this.body[field];
      return;
    }

    this.body[field] = preparedValue;
  }

  execute() {
    this.isPending = true;
    return this.vcs
      .exec(this.selectedCmd, this.body)
      .pipe(
        tap(res => (this.response = res)),
        tap(() => this.refresh$.next(""))
      )
      .toPromise()
      .finally(() => (this.isPending = false));
  }
}
