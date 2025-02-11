import {Component, OnInit, OnDestroy} from "@angular/core";
import {WebhookLogFilter, WebhookLog} from "@spica-client/function/interface";
import {WebhookService} from "@spica-client/function/services/webhook.service";
import {DataSource} from "@angular/cdk/table";
import {Subscription, BehaviorSubject, Observable} from "rxjs";
import {CollectionViewer} from "@angular/cdk/collections";
import {mergeMap, map} from "rxjs/operators";

@Component({
  selector: "app-webhook-log-view",
  templateUrl: "./webhook-log-view.component.html",
  styleUrls: ["./webhook-log-view.component.scss"]
})
export class WebhookLogViewComponent extends DataSource<WebhookLog> implements OnInit, OnDestroy {
  private subscription = new Subscription();

  statusCodes = [];

  webhooks: string[] = [];

  logs: WebhookLog[] = [];

  private dataStream = new BehaviorSubject<WebhookLog[]>(this.logs);

  isPending = false;

  private lastPage = 0;

  private pageSize = 0;

  private pageIndex = 0;

  private defaultLimit = 20;

  dataSource: WebhookLogViewComponent;

  filter: WebhookLogFilter = {
    date: {
      begin: undefined,
      end: undefined
    },
    succeed: null,
    webhooks: [],
    limit: this.defaultLimit,
    skip: undefined
  };

  filter$ = new BehaviorSubject<WebhookLogFilter>(this.filter);

  connect(collectionViewer: CollectionViewer): Observable<WebhookLog[]> {
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
    this.filter$.next({
      ...this.filter,
      limit: this.defaultLimit,
      skip: this.defaultLimit * this.pageIndex
    });
  }

  constructor(private webhookService: WebhookService) {
    super();
    this.dataSource = this;
    for (let index = 100; index < 600; index++) {
      this.statusCodes.push(index);
    }
  }

  ngOnInit() {
    this.webhookService
      .getLogs(this.filter)
      .toPromise()
      .then(logs => {
        this.logs = logs;
        this.webhooks = logs.reduce((acc, current) => {
          if (!acc.includes(current.webhook)) acc.push(current.webhook);
          return acc;
        }, []);
      });

    this.filter$
      .pipe(
        mergeMap(filter => {
          this.isPending = true;
          if (filter.skip) {
            return this.webhookService
              .getLogs(filter)
              .pipe(map(logs => this.logs.concat(logs)))
              .toPromise();
          } else {
            return this.webhookService.getLogs(filter);
          }
        })
      )
      .subscribe(
        logs => {
          this.isPending = false;
          this.logs = logs;
          this.dataStream.next(this.logs);
        },
        error => {
          this.isPending = false;
        }
      );
  }

  applyFilter() {
    this.pageSize = 0;
    this.filter = {...this.filter, limit: this.defaultLimit, skip: undefined};
    this.filter$.next(this.filter);
  }

  clearFilter() {
    this.filter = {
      date: {
        begin: undefined,
        end: undefined
      },
      succeed: null,
      webhooks: [],
      limit: this.defaultLimit,
      skip: undefined
    };

    this.pageSize = 0;

    this.filter$.next(this.filter);
  }

  clearLogs() {
    this.webhookService
      .clearLogs(this.logs.map(log => log._id))
      .toPromise()
      .then(() => {
        this.filter$.next(this.filter);
      });
  }

  setDate(begin: Date, end: Date) {
    this.filter.date = {
      begin: new Date(begin.setHours(0, 0, 0, 0)),
      end: new Date(end.setHours(23, 59, 59, 999))
    };
  }

  ngOnDestroy() {
    this.dataStream.unsubscribe();
    this.filter$.unsubscribe();
  }
}
