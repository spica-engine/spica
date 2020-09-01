import {Component, OnInit} from "@angular/core";
import {BucketService} from "@spica-client/bucket";
import {map, switchMap} from "rxjs/operators";
import {Observable, BehaviorSubject} from "rxjs";

@Component({
  selector: "dashboard",
  templateUrl: "./dashboard.component.html",
  styleUrls: ["./dashboard.component.scss"]
})
export class DashboardComponent implements OnInit {
  constructor(private bucketService: BucketService) {}

  isTutorialEnabled$: Observable<Boolean>;
  refresh$: BehaviorSubject<any> = new BehaviorSubject("");

  ngOnInit() {
    this.isTutorialEnabled$ = this.refresh$.pipe(
      switchMap(() =>
        this.bucketService
          .retrieve()
          .pipe(map(buckets => buckets.length == 0 && !localStorage.getItem("hide-tutorial")))
      )
    );
  }

  onDisable() {
    localStorage.setItem("hide-tutorial", "true");
    this.refresh$.next("");
  }
}
