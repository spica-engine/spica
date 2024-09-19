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

  borderColor = "rgb(47, 114, 255)";
  lineBackgroundColor = "rgba(47, 114, 255, 0.1)";

  requestDataLength = 40;
  downloadUploadDataLength = this.requestDataLength / 2;

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
    this.dispose.next(null);
  }

  onDisable() {
    localStorage.setItem("hide-tutorial", "true");
    this.refresh$.next("");
  }

  getDateRangesBetween(begin: Date, end: Date, length: number) {
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

    const colors = [
      {
        backgroundColor: this.borderColor,
        borderColor: this.borderColor,
        pointBackgroundColor: this.borderColor
      }
    ];

    if (name == "request") {
      colors[0].backgroundColor = this.lineBackgroundColor;
    }

    this.apiChart[name] = of({
      datasets: [
        {
          data: data
        }
      ],
      label: xLabels,
      colors,
      options: {
        scaleBeginAtZero: false,
        barBeginAtOrigin: true,
        responsive: true,
        maintainAspectRatio: false,
        legend: {
          display: false
        },
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
    const ranges = this.getDateRangesBetween(begin, end, this.requestDataLength);

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
        const chunkSize = this.requestDataLength / this.downloadUploadDataLength;
        this.apiDownloadedData = this.reduceDataLength(this.apiDownloadedData, chunkSize);
        this.apiUploadedData = this.reduceDataLength(this.apiUploadedData, chunkSize);

        const rangesToTitles = ranges => ranges.map(d => d[0].toLocaleString());

        const requestLabels = rangesToTitles(ranges);

        const downloadUploadRanges = this.getDateRangesBetween(
          begin,
          end,
          this.downloadUploadDataLength
        );
        const downloadUploadLabels = rangesToTitles(downloadUploadRanges);

        this.setApiChart("request", requestLabels, this.apiRequestData, "Count", true, begin, end);
        this.setApiChart(
          "downloaded",
          downloadUploadLabels,
          this.apiDownloadedData,
          "Mb",
          false,
          begin,
          end
        );
        this.setApiChart(
          "uploaded",
          downloadUploadLabels,
          this.apiUploadedData,
          "Mb",
          false,
          begin,
          end
        );
      })
      .finally(() => (this.apiStatusPending = false));
  }

  reduceDataLength(data: any[], chunkSize: number) {
    const newData = [];

    const sum = (arr: number[]) => arr.reduce((acc, curr) => (acc += curr));

    for (let i = 0; i <= data.length - chunkSize; i = i + chunkSize) {
      const chunk = data.slice(i, i + chunkSize);
      newData.push(sum(chunk));
    }
    return newData;
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
