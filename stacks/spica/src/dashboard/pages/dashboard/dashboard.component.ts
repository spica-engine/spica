import {Component, OnInit} from "@angular/core";
import {BucketService} from "@spica-client/bucket";
import {map, switchMap} from "rxjs/operators";
import {Observable, BehaviorSubject, of, combineLatest} from "rxjs";
import {PassportService} from "@spica-client/passport";
import {HttpClient, HttpParams} from "@angular/common/http";

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
  apiCallData = [];
  apiDownloadedData = [];
  apiUploadedData = [];

  updateApiChart(name: string, label: string, labels: string[], data: number[], unit: string) {
    this.apiChart[name] = of({
      datasets: [
        {
          data: data,
          // label: label
          // lineTension: 0
        }
      ],
      label: labels,
      options: {
        responsive: true,

        scales: {
          yAxes: [
            {
              scaleLabel: {
                display: true,
                labelString: unit
              }
            }
          ],
          xAxes: [
            {
              scaleLabel: {
                display: true,
                labelString: "Hours"
              }
            }
          ]
        }
      },
      colors: [
        {
          borderColor: "rgba(255,0,0,0.3)",
          backgroundColor: "rgba(255,0,0,0.3)"
        }
      ],
      legend: true,
      type: "bar",
      plugins: []
    });
  }

  stats: ApiStatus[] = [];
  apiChart = {
    call: of(),
    downloaded: of(),
    uploaded: of()
  };

  constructor(private http: HttpClient) {
    this.http
      .get<ApiStatus[]>("api:/status")
      .toPromise()
      .then(r => {
        this.stats = r
          .filter(s => {
            // for test purpose
            // for (const [key, value] of Object.entries(s.status)) {
            //   s.status[key].limit = value.limit || 100;
            // }
            if (s.module == "api") {
              return false;
            }
            return true;
          })
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
    const hour = 60 * 60 * 1000;

    const today = new Date();
    today.setMinutes(0, 0, 0);

    let dates: Date[][] = [];

    dates.push([today, new Date()]);

    Array.from({length: 24}, (_, i) => i + 1).forEach(i => {
      dates.push([
        new Date(today.getTime() - i * hour),
        new Date(today.getTime() - (i - 1) * hour)
      ]);
    });

    dates.reverse();
    

    // const dates = [
    //   [new Date(today.getTime() - 4 * hour), new Date(today.getTime() - 3 * hour)],
    //   [new Date(today.getTime() - 3 * hour), new Date(today.getTime() - 2 * hour)],
    //   [new Date(today.getTime() - 2 * hour), new Date(today.getTime() - 1 * hour)],
    //   [new Date(today.getTime() - 1 * hour), today],
    //   [today, new Date()]
    // ];

    const promises = dates.map((d, i) => {
      const url = new URL("api:/status/api");
      url.searchParams.set("begin", d[0].toISOString());
      url.searchParams.set("end", d[1].toISOString());

      this.apiCallData[i] = 0;
      this.apiDownloadedData[i] = 0;
      this.apiUploadedData[i] = 0;

      return this.http
        .get(url.toString())
        .toPromise()
        .then((r: any) => {
          this.apiCallData[i] = r.status.calls.current;
          this.apiDownloadedData[i] = r.status.downloaded.current;
          this.apiUploadedData[i] = r.status.uploaded.current;
        });
    });

    Promise.all(promises).then(() => {
      let labels = dates.map(d => {
        return d[0].getHours().toString();
        // `${i.getHours().toString()}:${(i.getMinutes() < 10 ? "0" : "") +
        //   i.getMinutes().toString()}`
      });
      this.updateApiChart("call", "Calls", labels.concat(), this.apiCallData, "count");
      this.updateApiChart("downloaded", "Download size", labels, this.apiDownloadedData, "mb");
      this.updateApiChart("uploaded", "Uploaded size", labels, this.apiUploadedData, "mb");
    });
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
}
