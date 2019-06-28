import {Component, forwardRef, HostListener, Inject, OnInit, ViewChild} from "@angular/core";
import {ControlValueAccessor, NG_VALUE_ACCESSOR} from "@angular/forms";
import {MatPaginator} from "@angular/material/paginator";
import {INPUT_SCHEMA} from "@spica-client/common";
import {PreferencesService} from "@spica-client/core";
import {merge, Observable, of, Subject} from "rxjs";
import {map, switchMap, tap} from "rxjs/operators";
import {BucketDataService} from "../../services/bucket-data.service";
import {BucketService} from "../../services/bucket.service";
import {Bucket} from "../../interfaces/bucket";
import {BucketData, BucketRow} from "../../interfaces/bucket-entry";
import {RelationSchema} from "../relation";

@Component({
  selector: "bucket-relation",
  templateUrl: "./relation.component.html",
  styleUrls: ["./relation.component.scss"],
  viewProviders: [{provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => RelationComponent)}]
})
export class RelationComponent implements ControlValueAccessor, OnInit {
  @ViewChild(MatPaginator, {static: true}) paginator: MatPaginator;

  value: string;

  onTouchedFn: () => void;
  onChangeFn: (value: string) => void;

  $row: Observable<BucketRow>;
  $meta: Observable<Bucket>;
  $data: Observable<BucketData>;

  public displayedProperties: Array<string> = [];

  public refresh: Subject<void> = new Subject<void>();

  bucketPrefs;

  constructor(
    @Inject(INPUT_SCHEMA) public schema: RelationSchema,
    private bds: BucketDataService,
    private ss: PreferencesService,
    bs: BucketService
  ) {
    this.$meta = bs.getBucket(schema.bucket).pipe(
      tap(bSchema => {
        if (bSchema) {
          this.displayedProperties = Object.entries(bSchema.properties)
            .filter(([, value]) => value.options.visible)
            .map(([key]) => key)
            .concat("actions");
        }
      })
    );
    this.ss.get("bucket").subscribe(data => (this.bucketPrefs = data));
  }

  ngOnInit() {
    this.$data = merge(this.paginator.page, of(null), this.refresh).pipe(
      switchMap(() =>
        this.bds.find(this.schema.bucket, {
          limit: this.paginator.pageSize || 12,
          skip: this.paginator.pageSize * this.paginator.pageIndex
        })
      ),
      map(buckets => {
        this.paginator.length = 0;
        if (buckets.meta && buckets.meta.total) {
          this.paginator.length = buckets.meta.total;
        }
        return buckets.data;
      })
    );
  }

  _fetchRow(id: string): void {
    this.$row = this.bds.findOne(this.schema.bucket, id, false);
  }

  _selectRow(row: BucketRow): void {
    this.value = row._id;
    this._fetchRow(this.value);
    if (this.onChangeFn) {
      this.onChangeFn(this.value);
    }
  }

  @HostListener("click")
  onTouched(): void {
    if (this.onTouchedFn) {
      this.onTouchedFn();
    }
  }

  writeValue(val: string): void {
    this.value = val;
    if (val) {
      this._fetchRow(this.value);
    }
  }

  registerOnChange(fn: any): void {
    this.onChangeFn = fn;
  }

  registerOnTouched(fn: any): void {
    this.onTouchedFn = fn;
  }

  // TODO: Filter the fields once there will be a feature like so
  _normalizeColumns(input: any): string {
    return input.name;
  }
}
