import {Component, OnDestroy, OnInit} from "@angular/core";
import {map, switchMap, takeUntil} from "rxjs/operators";
import {Observable, BehaviorSubject, of, Subject} from "rxjs";
import {HttpClient} from "@angular/common/http";
import {PassportService} from "@spica-client/passport";
import {ActivatedRoute} from "@angular/router";

interface ApiStatus {
  module: string;
  status: {
    [key: string]: {
      current?: number;
      limit?: number;
      unit?: string;
    };
  };
}

@Component({
  selector: "dashboard",
  templateUrl: "./dashboard.component.html",
  styleUrls: ["./dashboard.component.scss"]
})
export class DashboardComponent implements OnInit, OnDestroy {
  stats: ApiStatus[] = [];

  apiRequestData = [];
  apiDownloadedData = [];
  apiUploadedData = [];

  apiChart = {
    request: of(),
    uploaded: of(),
    downloaded: of()
  };

  today: Date;

  apiStatusPending;

  constructor(
    private activatedRoute: ActivatedRoute,
    private http: HttpClient,
    private passport: PassportService
  ) {}

  isTutorialEnabled$: Observable<Boolean>;
  refresh$: BehaviorSubject<any> = new BehaviorSubject("");

  dispose = new Subject();

  ngOnInit() {
    this.activatedRoute.url.pipe(takeUntil(this.dispose)).subscribe(() => {
      const storage = this.getModuleStatus("storage").then(res => res && this.stats.push(res));
      const identity = this.getModuleStatus("identity").then(res => res && this.stats.push(res));

      const fn = this.getModuleStatus("function").then(res => {
        if (!res) {
          return;
        }

        delete res.status.workers;
        this.stats.push(res);
      });

      const bucket = this.getModuleStatus("bucket").then(res => {
        if (!res) {
          return;
        }
        Object.keys(res.status).forEach(subModule => {
          if (subModule != "bucketData") {
            delete res.status[subModule];
          }
        });
        this.stats.push(res);
      });

      Promise.all([storage, fn, bucket, identity]);

      this.today = new Date();
      this.today.setHours(0, 0, 0, 0);

      this.updateApiStatusCharts(this.today, new Date());

      this.isTutorialEnabled$ = this.refresh$.pipe(
        map(() => !localStorage.getItem("hide-tutorial"))
      );
    });
  }

  ngOnDestroy() {
    this.dispose.next();
  }

  onDisable() {
    localStorage.setItem("hide-tutorial", "true");
    this.refresh$.next("");
  }

  getDateRangesBetween(begin: Date, end: Date, length: number = 40) {
    const multiplier = (end.getTime() - begin.getTime()) / length;

    const dates: Date[][] = [];

    Array.from({length}, (_, i) => i).forEach(i => {
      dates.push([
        new Date(begin.getTime() + i * multiplier),
        new Date(begin.getTime() + (i + 1) * multiplier)
      ]);
    });

    return dates;
  }

  setApiChart(
    name: string,
    dataLabel: string,
    xLabels: string[],
    data: number[],
    unit: string,
    filter: boolean = false,
    begin: Date,
    end: Date
  ) {
    const filters = [];

    if (filter) {
      filters.push(
        ...[
          {key: "begin", title: "Begin Date", type: "date", value: begin},
          {key: "end", title: "End Date", type: "date", value: end}
        ]
      );
    }

    this.apiChart[name] = of({
      datasets: [
        {
          data: data,
          label: dataLabel
        }
      ],
      label: xLabels,
      colors: [{backgroundColor: "#28a745"}],
      options: {
        scaleBeginAtZero: false,
        barBeginAtOrigin: true,
        responsive: true,
        maintainAspectRatio: false,
        tooltips: {
          callbacks: {
            title: items => {
              const _begin = xLabels[items[0].index];
              let _end = xLabels[items[0].index + 1];
              if (typeof _end == "undefined") {
                _end = end.toLocaleString();
              }
              return _begin + " - " + _end;
            }
          }
        },
        scales: {
          yAxes: [
            {
              ticks: {
                beginAtZero: true
              },
              scaleLabel: {
                display: true,
                labelString: unit
              }
            }
          ],
          xAxes: [
            {
              display: false
            }
          ]
        }
      },
      type: "bar",
      plugins: [],
      filters
    });
  }

  onApiStatusFilterUpdate([{value: begin}, {value: end}]) {
    this.updateApiStatusCharts(begin, end);
  }

  updateApiStatusCharts(begin: Date, end: Date) {
    this.apiStatusPending = true;
    const ranges = this.getDateRangesBetween(begin, end);

    const promises = ranges.map((range, i) => {
      const url = new URL("api:/status/api");
      url.searchParams.set("begin", range[0].toISOString());
      url.searchParams.set("end", range[1].toISOString());

      this.apiRequestData[i] = 0;
      this.apiDownloadedData[i] = 0;
      this.apiUploadedData[i] = 0;

      return this.getModuleStatus("api", url.toString()).then(res => {
        if (!res) {
          this.apiChart = undefined;
          return;
        }

        const {
          status: {request, downloaded, uploaded}
        } = res;

        this.apiRequestData[i] = request.current;
        this.apiDownloadedData[i] = downloaded.current;
        this.apiUploadedData[i] = uploaded.current;
      });
    });

    return Promise.all(promises)
      .then(() => {
        const labels = ranges.map(d => d[0].toLocaleString());
        this.setApiChart(
          "request",
          "Request",
          labels,
          this.apiRequestData,
          "Count",
          true,
          begin,
          end
        );
        this.setApiChart(
          "downloaded",
          "Downloaded(mb)",
          labels,
          this.apiDownloadedData,
          "Mb",
          false,
          begin,
          end
        );
        this.setApiChart(
          "uploaded",
          "Uploaded(mb)",
          labels,
          this.apiUploadedData,
          "Mb",
          false,
          begin,
          end
        );
      })
      .finally(() => (this.apiStatusPending = false));
  }

  getModuleStatus(
    module: string,
    url = `api:/status/${module}`,
    action = "show"
  ): Promise<ApiStatus | undefined> {
    return this.passport
      .checkAllowed("status:" + action, module)
      .pipe(switchMap(r => (r ? this.http.get<ApiStatus>(url) : of<undefined>())))
      .toPromise();
  }
}
