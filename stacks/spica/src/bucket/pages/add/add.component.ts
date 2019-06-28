import {Component, HostListener, OnInit} from "@angular/core";
import {ActivatedRoute, Router} from "@angular/router";
import {PreferencesService} from "@spica-client/core";
import {Observable, of} from "rxjs";
import {switchMap, tap} from "rxjs/operators";
import {BucketDataService} from "../../bucket-data.service";
import {BucketHistoryService} from "../../bucket-history.service";
import {BucketService} from "../../bucket.service";
import {Bucket, Property} from "../../interfaces/bucket";
import {BucketRow, EMPTY_BUCKET_ROW} from "../../interfaces/bucket-entry";
import {BucketHistory} from "../../interfaces/bucket-history";
import {BucketSettings} from "../../interfaces/bucket-settings";

@Component({
  selector: "bucket-add",
  templateUrl: "./add.component.html",
  styleUrls: ["./add.component.scss"]
})
export class AddComponent implements OnInit {
  bucketId: string;
  bucketRowId: string;
  bucket$: Observable<Bucket>;
  data: BucketRow;
  histories: Array<BucketHistory>;
  selectedHistoryId: string;
  bucketSettings: BucketSettings;

  postitioning: {[key: string]: {key: string; value: Property}[]};

  divisionsOrder = ["left", "right", "bottom"];

  windowWidth;

  constructor(
    private bs: BucketService,
    private bds: BucketDataService,
    private bhs: BucketHistoryService,
    private ss: PreferencesService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  @HostListener("window:resize")
  onResize() {
    this.windowWidth = window.innerWidth;
  }

  ngOnInit(): void {
    this.ss
      .get<BucketSettings>("bucket")
      .pipe(
        tap(settings => (this.bucketSettings = settings)),
        switchMap(() => this.route.params),
        tap(params => {
          this.bucketId = params.id;
          this.bucketRowId = params.rid;
          this.bucket$ = this.bs.getBucket(this.bucketId);
        }),
        switchMap(() => {
          if (this.bucketRowId) {
            return this.bhs.historyList(this.bucketId, this.bucketRowId).pipe(
              tap(histories => {
                this.histories = histories;
              }),
              switchMap(() => {
                return this.bds.findOne(this.bucketId, this.bucketRowId);
              })
            );
          } else {
            return of({...EMPTY_BUCKET_ROW});
          }
        })
      )
      .subscribe(data => {
        this.normalize(this.bucket$, data);
        this.data = data;
      });
    this.windowWidth = window.innerWidth;
  }

  getHistoryData(historyId) {
    this.bhs.revertTo(this.bucketId, this.data._id, historyId).subscribe(data => {
      this.normalize(this.bucket$, data);
      this.data = data;
      this.selectedHistoryId = historyId;
    });
  }

  saveBucketRow() {
    this.bds
      .replaceOne(this.bucketId, this.data)
      .toPromise()
      .then(() => this.router.navigate(["bucket", this.bucketId]));
  }

  normalize(bucket: Observable<Bucket>, data: BucketRow): void {
    bucket.subscribe(b => {
      this.postitioning = Object.entries(b.properties).reduce(
        (accumulator, [key, value]) => {
          if (accumulator[value.options.position]) {
            accumulator[value.options.position].push({key, value});
          }
          return accumulator;
        },
        {left: [], right: [], bottom: []}
      );

      for (const fieldName of Object.keys(b.properties)) {
        if (data[fieldName] === undefined) {
          data[fieldName] = {};
          if (b.properties[fieldName].options.translate) {
            for (const lang of this.bucketSettings.language.supported_languages) {
              data[fieldName][lang.code] = undefined;
            }
          } else {
            data[fieldName] = undefined;
          }
        }
      }
    });
  }
}
