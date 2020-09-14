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
    this.isTutorialEnabled$ = combineLatest(
      this.passport.checkAllowed("bucket:index", "*"),
      this.passport.checkAllowed("bucket:create"),
      this.passport.checkAllowed("bucket:data:create", "*"),
      this.passport.checkAllowed("passport:apikey:create", "*"),
      this.passport.checkAllowed("passport:apikey:policy:add", "*/BucketFullAccess")
    ).pipe(
      switchMap(results =>
        results.every(isAllowed => isAllowed)
          ? this.refresh$.pipe(
              switchMap(() =>
                this.bucketService
                  .retrieve()
                  .pipe(
                    map(buckets => buckets.length == 0 && !localStorage.getItem("hide-tutorial"))
                  )
              )
            )
          : of(false)
      )
    );
  }

  onDisable() {
    localStorage.setItem("hide-tutorial", "true");
    this.refresh$.next("");
  }
}
