import {Component, OnInit} from "@angular/core";
import {VersionControlService} from "@spica-client/dashboard/services/versioncontrol.service";
import {BehaviorSubject, of} from "rxjs";
import {switchMap, tap} from "rxjs/operators";

@Component({
  selector: "versioncontrol",
  templateUrl: "./versioncontrol.component.html",
  styleUrls: ["./versioncontrol.component.scss"]
})
export class VersionControlComponent implements OnInit {
  lastSave$ = of();

  refresh$ = new BehaviorSubject("");

  constructor(private vcs: VersionControlService) {
    this.lastSave$ = this.refresh$.pipe(switchMap(() => this.vcs.getLastSave()));
  }

  save() {
    return this.vcs
      .save()
      .pipe(tap(() => this.refresh$.next("")))
      .toPromise();
  }
}
