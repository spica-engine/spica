import {Component, OnInit} from "@angular/core";
import {BucketService} from "@spica-client/bucket";
import {map, switchMap} from "rxjs/operators";
import {Observable, BehaviorSubject, of, combineLatest} from "rxjs";
import {PassportService} from "@spica-client/passport";

@Component({
  selector: "dashboard",
  templateUrl: "./dashboard.component.html",
  styleUrls: ["./dashboard.component.scss"]
})
export class DashboardComponent implements OnInit {
  constructor(private bucketService: BucketService, private passport: PassportService) {}

  isTutorialEnabled$: Observable<Boolean>;
  refresh$: BehaviorSubject<any> = new BehaviorSubject("");

  ngOnInit() {
    this.isTutorialEnabled$ = this.refresh$.pipe(map(() => !localStorage.getItem("hide-tutorial")));
  }

  onDisable() {
    localStorage.setItem("hide-tutorial", "true");
    this.refresh$.next("");
  }
}
