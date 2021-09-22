import {Component, OnInit} from "@angular/core";
import {map} from "rxjs/operators";
import {Observable, BehaviorSubject, of} from "rxjs";
import {HttpClient} from "@angular/common/http";

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
export class DashboardComponent implements OnInit {
  stats: ApiStatus[] = [];

  apiCallData = [];
  apiDownloadedData = [];
  apiUploadedData = [];

  apiChart = {
    call: of(),
    downloaded: of(),
    uploaded: of()
  };

  today: Date;

  apiStatusPending;

  constructor(private http: HttpClient) {
    this.http
      .get<ApiStatus[]>("api:/status")
      .toPromise()
      .then(r => {
        this.stats = r
          .filter(s => s.module != "api")
          .map(s => {
            switch (s.module) {
              case "bucket":
                Object.keys(s.status).forEach(k => {
                  if (k != "bucketData") {
                    delete s.status[k];
                  }
                });
                return s;

              case "function":
                delete s.status.workers;
                return s;

              default:
                return s;
            }
          });
      });

    this.today = new Date();
    this.today.setHours(0, 0, 0, 0);

    this.updateApiStatusCharts(this.today, new Date());
  }

  isTutorialEnabled$: Observable<Boolean>;
  refresh$: BehaviorSubject<any> = new BehaviorSubject("");

  ngOnInit() {
    this.isTutorialEnabled$ = this.refresh$.pipe(map(() => !localStorage.getItem("hide-tutorial")));
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

      this.apiCallData[i] = 0;
      this.apiDownloadedData[i] = 0;
      this.apiUploadedData[i] = 0;

      return this.http
        .get<ApiStatus>(url.toString())
        .toPromise()
        .then(({status: {calls, downloaded, uploaded}}) => {
          this.apiCallData[i] = calls.current;
          this.apiDownloadedData[i] = downloaded.current;
          this.apiUploadedData[i] = uploaded.current;
        });
    });

    return Promise.all(promises)
      .then(() => {
        const labels = ranges.map(d => d[0].toLocaleString());
        this.setApiChart("call", "Calls", labels, this.apiCallData, "Count", true, begin, end);
        this.setApiChart(
          "downloaded",
          "Download size(mb)",
          labels,
          this.apiDownloadedData,
          "Mb",
          false,
          begin,
          end
        );
        this.setApiChart(
          "uploaded",
          "Uploaded size(mb)",
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
}
