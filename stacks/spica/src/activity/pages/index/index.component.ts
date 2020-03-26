import {Component, OnInit} from "@angular/core";
import {Activity, getAvailableFilters, ActivityFilter} from "@spica-client/activity/interface";
import {ActivityService} from "@spica-client/activity/services/activity.service";
import {Observable, BehaviorSubject, Subscription} from "rxjs";
import {DataSource, CollectionViewer} from "@angular/cdk/collections";
import {switchMap, tap, map} from "rxjs/operators";

@Component({
  selector: "app-index",
  templateUrl: "./index.component.html",
  styleUrls: ["./index.component.scss"]
})
export class IndexComponent extends DataSource<Activity> implements OnInit {
  private cachedActivities = Array.from<Activity>({length: 0});

  private subscription = new Subscription();

  private dataStream = new BehaviorSubject<(Activity | undefined)[]>(this.cachedActivities);

  private pageSize = 2.5;
  private lastPage = 0;

  private pageIndex = 0;

  private defaultLimit = 20;

  connect(collectionViewer: CollectionViewer): Observable<(Activity | undefined)[]> {
    this.subscription.add(
      collectionViewer.viewChange.subscribe(range => {
        const currentPage = this._getPageForIndex(range.end);
        if (currentPage > this.lastPage) {
          this.lastPage = currentPage;
          this._fetchNextPage();
        }
      })
    );
    return this.dataStream;
  }

  disconnect(): void {
    this.subscription.unsubscribe();
  }

  private _fetchNextPage(): void {
    this.pageIndex++;
    this.appliedFilters$.next({
      ...this.selectedFilters,
      limit: this.defaultLimit,
      skip: this.defaultLimit * this.pageIndex
    });
  }

  private _getPageForIndex(i: number): number {
    return Math.floor(i / this.pageSize);
  }
  activities$: Observable<Activity[]>;

  availableFilters = getAvailableFilters();

  selectedFilters: ActivityFilter = {
    identifier: undefined,
    action: undefined,
    resource: {
      name: undefined,
      documentId: undefined
    },
    date: {
      begin: undefined,
      end: undefined
    },
    limit: this.defaultLimit,
    skip: undefined
  };

  dataSource: IndexComponent;

  appliedFilters$ = new BehaviorSubject<ActivityFilter>(this.selectedFilters);

  maxDate = new Date();

  constructor(private activityService: ActivityService) {
    super();
    this.dataSource = this;

    this.appliedFilters$
      .pipe(
        switchMap(filter => {
          if (filter.skip) {
            return this.activityService.get(filter).pipe(
              map(activities => {
                return this.cachedActivities.concat(activities);
              })
            );
          } else {
            return this.activityService.get(filter);
          }
        }),
        tap(activities => {
          {
            this.cachedActivities = activities;
            this.dataStream.next(this.cachedActivities);
          }
        })
      )
      .subscribe();
  }

  ngOnInit() {}

  clearFilters() {
    this.selectedFilters = {
      identifier: undefined,
      action: undefined,
      resource: {
        name: undefined,
        documentId: undefined
      },
      date: {
        begin: undefined,
        end: undefined
      },
      limit: this.defaultLimit,
      skip: undefined
    };
    this.lastPage = 0;
    this.pageIndex = 0;
    this.appliedFilters$.next(this.selectedFilters);
  }

  applyFilters() {
    this.lastPage = 0;
    this.pageIndex = 0;
    this.selectedFilters = {...this.selectedFilters, limit: this.defaultLimit, skip: undefined};
    this.appliedFilters$.next(this.selectedFilters);
  }

  showDocuments(moduleName: string) {
    console.log(moduleName);
  }

  ngOnDestroy() {
    this.appliedFilters$.unsubscribe();
  }
}
