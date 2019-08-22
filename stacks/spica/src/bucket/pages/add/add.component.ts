import {Component, OnInit} from "@angular/core";
import {ActivatedRoute, Router} from "@angular/router";
import {Observable} from "rxjs";
import {map, switchMap, tap} from "rxjs/operators";
import {Bucket} from "../../interfaces/bucket";
import {BucketRow} from "../../interfaces/bucket-entry";
import {BucketHistory} from "../../interfaces/bucket-history";
import {BucketDataService} from "../../services/bucket-data.service";
import {BucketHistoryService} from "../../services/bucket-history.service";
import {BucketService} from "../../services/bucket.service";

@Component({
  selector: "bucket-add",
  templateUrl: "./add.component.html",
  styleUrls: ["./add.component.scss"]
})
export class AddComponent implements OnInit {
  bucketId: string;
  data: BucketRow = {};
  now: BucketRow;
  minScheduleDate: Date = new Date();
  bucket$: Observable<Bucket>;
  histories$: Observable<Array<BucketHistory>>;

  layouts = ["left", "right", "bottom"];

  constructor(
    private bs: BucketService,
    private bds: BucketDataService,
    private bhs: BucketHistoryService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.bucket$ = this.route.params.pipe(
      tap(params => {
        this.bucketId = params.id;
        if (params.rid) {
          this.histories$ = this.bhs.historyList(params.id, params.rid);
        }
      }),
      switchMap(params => {
        if (params.rid) {
          return this.bds.findOne(params.id, params.rid, true).pipe(
            tap(data => {
              this.data = data;
            }),
            switchMap(() => this.bs.getBucket(params.id))
          );
        }
        return this.bs.getBucket(params.id);
      }),
      map(schema => {
        this.data._schedule = this.data._schedule && new Date(this.data._schedule);

        // What we do here is simply coercing the translated data
        Object.keys(schema.properties).forEach(key => {
          const property = schema.properties[key];
          if (property.options && property.options.translate) {
            this.data[key] = this.data[key] || {};
          }
        });
        schema["positioned"] = Object.entries(schema.properties).reduce(
          (accumulator, [key, value]) => {
            if (accumulator[value.options.position]) {
              accumulator[value.options.position].push({key, value});
            }
            return accumulator;
          },
          {left: [], right: [], bottom: []}
        );
        return schema;
      })
    );
  }

  async revert(historyId: string) {
    if (!this.now) {
      this.now = this.data;
    }
    this.data = await this.bhs.revertTo(this.bucketId, this.data._id, historyId).toPromise();
  }

  schedule() {
    this.data._schedule = new Date();
  }

  cancelSchedule() {
    this.data._schedule = undefined;
  }

  saveBucketRow() {
    if (!(this.data._schedule instanceof Date)) {
      delete this.data._schedule;
    }

    this.bds
      .replaceOne(this.bucketId, this.data)
      .toPromise()
      .then(() => this.router.navigate(["bucket", this.bucketId]));
  }
}
