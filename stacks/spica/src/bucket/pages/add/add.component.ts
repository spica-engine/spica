import {animate, style, transition, trigger} from "@angular/animations";
import {BreakpointObserver, Breakpoints} from "@angular/cdk/layout";
import {Component, OnInit} from "@angular/core";
import {ActivatedRoute, Router} from "@angular/router";
import {Observable} from "rxjs";
import {flatMap, map, share, switchMap, tap} from "rxjs/operators";
import {Bucket} from "../../interfaces/bucket";
import {BucketRow} from "../../interfaces/bucket-entry";
import {BucketHistory} from "../../interfaces/bucket-history";
import {BucketDataService} from "../../services/bucket-data.service";
import {BucketHistoryService} from "../../services/bucket-history.service";
import {BucketService} from "../../services/bucket.service";

@Component({
  selector: "bucket-add",
  templateUrl: "./add.component.html",
  styleUrls: ["./add.component.scss"],
  animations: [
    trigger("smooth", [
      transition(":enter", [style({opacity: 0}), animate("0.3s ease-out", style({opacity: 1}))]),
      transition(":leave", [style({opacity: 1}), animate("0.3s ease-in", style({opacity: 0}))])
    ])
  ]
})
export class AddComponent implements OnInit {
  bucketId: string;
  data: BucketRow = {};
  now: BucketRow;
  minScheduleDate: Date = new Date();
  bucket$: Observable<Bucket>;
  histories$: Observable<Array<BucketHistory>>;

  savingBucketState: Boolean = false;

  readonly layouts = ["left", "right", "bottom"];

  readonly isHandset$: Observable<boolean>;

  constructor(
    private bs: BucketService,
    private bds: BucketDataService,
    private bhs: BucketHistoryService,
    private router: Router,
    private route: ActivatedRoute,
    breakpointObserver: BreakpointObserver
  ) {
    this.isHandset$ = breakpointObserver
      .observe([Breakpoints.Medium, Breakpoints.Small, Breakpoints.XSmall])
      .pipe(map(r => r.matches));
  }

  ngOnInit(): void {
    this.bucket$ = this.route.params.pipe(
      tap(params => {
        this.bucketId = params.id;
        if (params.rid) {
          this.histories$ = this.bhs.historyList(params.id, params.rid);
        }
      }),
      flatMap(params => {
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
      }),
      share()
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
    this.savingBucketState = true;
    if (!(this.data._schedule instanceof Date)) {
      delete this.data._schedule;
    }

    this.bds
      .replaceOne(this.bucketId, this.data)
      .toPromise()
      .then(data => {
        this.savingBucketState = false;
        if (!this.data._id) {
          this.router.navigate(["bucket", this.bucketId]);
        }
        this.histories$ = this.bhs.historyList(this.bucketId, data);
      });
  }
}
