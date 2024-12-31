import {Component, OnInit, OnDestroy} from "@angular/core";
import {Activity, ActivityFilter} from "@spica-client/activity/interface";
import {ActivityService} from "@spica-client/activity/services/activity.service";
import {Observable, BehaviorSubject, Subscription, of} from "rxjs";
import {DataSource, CollectionViewer} from "@angular/cdk/collections";
import {map, mergeMap, switchMap} from "rxjs/operators";
import {MatLegacyOption as MatOption} from "@angular/material/legacy-core";
import {MatLegacySelectChange as MatSelectChange} from "@angular/material/legacy-select";

@Component({
  selector: "activity-index",
  templateUrl: "./index.component.html",
  styleUrls: ["./index.component.scss"]
})
export class IndexComponent extends DataSource<Activity> implements OnInit, OnDestroy {
  buckets$: Observable<any>;

  documents$: Observable<any>;

  documentIds: string[] = [];

  isPending = false;

  activities: Activity[] = [];

  private subscription = new Subscription();

  private dataStream = new BehaviorSubject<(Activity)[]>(this.activities);

  private lastPage = 0;

  private pageSize = 0;

  private pageIndex = 0;

  private defaultLimit = 20;

  connect(collectionViewer: CollectionViewer): Observable<(Activity)[]> {
    this.subscription.add(
      collectionViewer.viewChange.subscribe(range => {
        if (!this.pageSize) {
          this.pageIndex = 0;
          this.pageSize = this.lastPage = range.end;
          return;
        }

        if (range.end >= this.lastPage) {
          this.lastPage = range.end + this.pageSize;
          this.fetchNextPage();
        }
      })
    );
    return this.dataStream;
  }

  disconnect(): void {
    this.subscription.unsubscribe();
  }

  fetchNextPage(): void {
    this.pageIndex++;
    this.filters$.next({
      ...this.filters,
      limit: this.defaultLimit,
      skip: this.defaultLimit * this.pageIndex
    });
  }

  filters: ActivityFilter = {
    identifier: undefined,
    action: [],
    resource: {$all: [], $in: []},
    date: {
      begin: undefined,
      end: undefined
    },
    limit: this.defaultLimit,
    skip: 0
  };

  dataSource: IndexComponent;

  filters$ = new BehaviorSubject<ActivityFilter>(this.filters);

  constructor(private activityService: ActivityService) {
    super();
    this.dataSource = this;
  }

  ngOnInit() {
    this.buckets$ = this.checkAllowed("bucket:index").pipe(
      switchMap(allowed => (allowed ? this.activityService.getBuckets() : of([])))
    );

    this.filters$
      .pipe(
        mergeMap(filter => {
          this.isPending = true;
          if (filter.skip) {
            return this.activityService
              .get(filter)
              .pipe(map(activities => this.activities.concat(activities)))
              .toPromise();
          } else {
            return this.activityService.get(filter).toPromise();
          }
        })
      )
      .subscribe(
        activities => {
          this.isPending = false;
          this.activities = activities;
          this.dataStream.next(this.activities);
        },
        _ => {
          this.isPending = false;
        }
      );
  }

  clearFilters() {
    this.filters = {
      identifier: undefined,
      action: [],
      resource: {$all: [], $in: []},
      date: {
        begin: undefined,
        end: undefined
      },
      limit: this.defaultLimit,
      skip: 0
    };

    this.documentIds = undefined;
    this.pageSize = 0;

    this.filters$.next(this.filters);
  }

  applyFilters() {
    this.pageSize = 0;

    this.filters = {...this.filters, limit: this.defaultLimit, skip: 0};
    this.filters$.next(this.filters);
  }

  onModuleSelectionChange(event: MatSelectChange) {
    const optGroup = (event.source.selected as MatOption).group
      ? (event.source.selected as MatOption).group.label.toLowerCase()
      : "";
    const selection = event.value;
    this.documents$ = this.activityService.getDocumentIds(optGroup, selection);
    this.filters.resource.$all = optGroup ? [optGroup, selection] : [selection];
    this.filters.resource.$in = [];
  }

  clearActivities() {
    this.activityService
      .deleteActivities(this.activities)
      .toPromise()
      .then(() => {
        this.filters$.next(this.filters);
      });
  }

  setDate(begin: Date, end: Date) {
    this.filters.date = {
      begin: new Date(begin.setHours(0, 0, 0, 0)),
      end: new Date(end.setHours(23, 59, 59, 999))
    };
  }

  checkAllowed(action: string) {
    return this.activityService.checkAllowed(action);
  }

  ngOnDestroy() {
    this.dataStream.unsubscribe();
    this.filters$.unsubscribe();
  }
}
