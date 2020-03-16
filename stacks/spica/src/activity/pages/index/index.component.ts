import {Component, OnInit} from "@angular/core";
import {Activity, getAvailableFilters, ActivityFilter} from "@spica-client/activity/interface";
import {ActivityService} from "@spica-client/activity/services/activity.service";
import {Observable, merge, Subject, BehaviorSubject, combineLatest} from "rxjs";
import {switchMap, map} from "rxjs/operators";

@Component({
  selector: "app-index",
  templateUrl: "./index.component.html",
  styleUrls: ["./index.component.scss"]
})
export class IndexComponent implements OnInit {
  activities$: Observable<Activity[]>;

  availableFilters = getAvailableFilters();

  selectedFilters: ActivityFilter = {
    actions: [],
    modules: [],
    date: {
      begin: undefined,
      end: undefined
    }
  };

  appliedFilters$ = new BehaviorSubject(this.selectedFilters);

  maxDate = new Date();

  displayedColumns: string[] = ["user", "action", "module", "documentId", "date"];

  constructor(private activityService: ActivityService) {}

  ngOnInit() {
    this.activities$ = this.appliedFilters$.pipe(
      switchMap(filter => this.activityService.get(filter))
    );
  }

  clearFilters() {
    this.selectedFilters = {
      actions: [],
      modules: [],
      date: {
        begin: undefined,
        end: undefined
      }
    };
  }

  applyFilters() {
    this.appliedFilters$.next(this.selectedFilters);
  }
}
