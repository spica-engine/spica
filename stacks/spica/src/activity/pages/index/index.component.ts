import {Component, OnInit, OnDestroy} from "@angular/core";
import {Activity, ActivityFilter} from "@spica-client/activity/interface";
import {ActivityService} from "@spica-client/activity/services/activity.service";
import {Observable, BehaviorSubject, Subscription} from "rxjs";
import {DataSource, CollectionViewer} from "@angular/cdk/collections";
import {map, mergeMap} from "rxjs/operators";

@Component({
  selector: "activity-index",
  templateUrl: "./index.component.html",
  styleUrls: ["./index.component.scss"]
})
export class IndexComponent extends DataSource<Activity> implements OnInit, OnDestroy {
  moduleGroups = [
    {
      name: "Bucket-Data",
      modules: []
    },
    {
      name: "Bucket",
      modules: ["Bucket"]
    },
    {
      name: "Passport",
      modules: ["Identity", "Policy", "Apikey"]
    },
    {
      name: "Storage",
      modules: ["Storage"]
    },
    {
      name: "Function",
      modules: ["Function"]
    },
    {
      name: "Preference",
      modules: ["Preference"]
    }
  ];

  actions = ["Insert", "Update", "Delete"];

  documentIds: string[] = [];

  maxDate = new Date();

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

  filters$ = new BehaviorSubject<ActivityFilter>(this.filters);

  constructor(private activityService: ActivityService) {
    super();
    this.dataSource = this;
  }

  ngOnInit() {
    this.activityService
      .getDocuments("buckets")
      .toPromise()
      .then(documentIds =>
        documentIds.forEach(id => {
          this.moduleGroups[0].modules.push(`Bucket_${id}`);
        })
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
        error => {
          this.isPending = false;
        }
      );
  }

  clearFilters() {
    this.filters = {
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

    this.documentIds = undefined;
    this.pageSize = 0;

    this.filters$.next(this.filters);
  }

  applyFilters() {
    this.pageSize = 0;

    this.filters = {...this.filters, limit: this.defaultLimit, skip: undefined};
    this.filters$.next(this.filters);
  }

  showDocuments(moduleName: string) {
    if (moduleName == "Preference") {
      this.documentIds = ["bucket", "passport"];
      return;
    }
    this.documentIds = undefined;
    this.activityService
      .getDocuments(moduleName.toLowerCase())
      .toPromise()
      .then(documentIds => (this.documentIds = documentIds));
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

  ngOnDestroy() {
    this.dataStream.unsubscribe();
    this.filters$.unsubscribe();
  }
}
