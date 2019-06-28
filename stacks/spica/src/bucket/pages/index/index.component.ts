import {Component, OnInit, ViewChild} from "@angular/core";
import {MatPaginator} from "@angular/material/paginator";
import {Sort} from "@angular/material/sort";
import {ActivatedRoute} from "@angular/router";
import {merge, Observable, of, Subject} from "rxjs";
import {map, switchMap, tap} from "rxjs/operators";
import {BucketDataService} from "../../services/bucket-data.service";
import {BucketService} from "../../services/bucket.service";
import {Bucket} from "../../interfaces/bucket";
import {BucketAggregations, emptyBucketAggregations} from "../../interfaces/bucket-aggregations";
import {BucketData} from "../../interfaces/bucket-entry";
import {BucketSettings} from "../../interfaces/bucket-settings";

@Component({
  selector: "bucket-index",
  templateUrl: "./index.component.html",
  styleUrls: ["./index.component.scss"]
})
export class IndexComponent implements OnInit {
  @ViewChild(MatPaginator, {static: true}) paginator: MatPaginator;

  public bucketId: string;
  public $meta: Observable<Bucket>;
  public $data: Observable<BucketData>;
  public refresh: Subject<void> = new Subject<void>();
  public aggregations: BucketAggregations = {...emptyBucketAggregations()};

  public displayedProperties: Array<string> = [];

  public $preferences: Observable<BucketSettings>;
  public language: string;

  public selectAll: boolean = false;
  public doClick: boolean = false;
  public arrayToDelete: Array<string> = [];
  public totalPageItem: number = 0;

  constructor(
    private bs: BucketService,
    private bds: BucketDataService,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.$meta = this.route.params.pipe(
      tap(params => {
        this.bucketId = params.id;
        this.paginator.pageIndex = 0;
        this.aggregations = {...emptyBucketAggregations()};
        this.fetchData();
        this.$preferences = this.bs.getPreferences();
      }),
      switchMap(() => this.bs.getBucket(this.bucketId)),
      tap(schema => {
        if (schema) {
          this.displayedProperties = Object.entries(schema.properties)
            .filter(([, value]) => value.options.visible)
            .map(([key]) => key)
            .concat("actions");
          this.displayedProperties = ["select"].concat(this.displayedProperties);
        }
      })
    );
  }

  toggleDisplayAll(display: boolean, schema: Bucket) {
    if (display) {
      this.displayedProperties = ["select"].concat(
        Object.keys(schema.properties).concat("actions")
      );
    } else {
      this.displayedProperties = ["select"].concat([schema.primary, "actions"]);
    }
  }

  fetchData(): void {
    this.$data = merge(this.paginator.page, of(null), this.refresh).pipe(
      switchMap(() =>
        this.bds.find(this.bucketId, {
          language: this.language,
          aggregations: this.aggregations,
          limit: this.paginator.pageSize || 12,
          skip: this.paginator.pageSize * this.paginator.pageIndex
        })
      ),
      map(buckets => {
        this.totalPageItem = 0;
        this.paginator.length = 0;
        if (buckets.meta && buckets.meta.total) {
          this.paginator.length = buckets.meta.total;
        }
        buckets.data.forEach(element => {
          this.totalPageItem++;
        });

        if (this.selectAll === true) {
          if (this.arrayToDelete.length > 0) {
            this.arrayToDelete = [];
          }
          buckets.data.forEach(element => {
            this.totalPageItem++;
            this.arrayToDelete.push(element._id);
          });
        }
        return buckets.data;
      })
    );
  }

  delete(id: string): void {
    this.bds
      .findOneAndDelete(this.bucketId, id)
      .toPromise()
      .then(() => this.fetchData());
  }

  // Sort on Server-side
  sortData(sort: Sort) {
    this.aggregations.sort = {active: sort.active, direction: sort.direction === "asc" ? 1 : -1};
    this.fetchData();
  }

  // All select checkbox
  allSelect(id) {
    this.doClick = !id;
    this.selectAll = id;
    if (this.selectAll == false) {
      this.arrayToDelete = [];
    }
    this.fetchData();
  }
  // Add one checkbox item
  addDeleteList(id) {
    let inArray: boolean = false;
    this.arrayToDelete.forEach((element, key) => {
      if (element == id) {
        this.arrayToDelete.splice(key, 1);
        inArray = true;
        this.doClick = false;
      }
    });
    if (inArray == false) {
      this.arrayToDelete.push(id);
    }
  }
  deleteArrayItems() {
    this.bds
      .deleteMany(this.bucketId, this.arrayToDelete)
      .toPromise()
      .then(() => {
        this.fetchData();
        this.arrayToDelete = [];
        this.totalPageItem = 0;
      });
  }
}
