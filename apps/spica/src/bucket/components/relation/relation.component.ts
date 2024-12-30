import {Component, forwardRef, HostListener, Inject, OnInit, ViewChild} from "@angular/core";
import {ControlValueAccessor, NG_VALUE_ACCESSOR} from "@angular/forms";
import {MatLegacyPaginator as MatPaginator} from "@angular/material/legacy-paginator";
import {INPUT_SCHEMA} from "@spica-client/common";
import {BehaviorSubject, merge, Observable, of, Subject} from "rxjs";
import {map, share, shareReplay, switchMap, tap} from "rxjs/operators";
import {Bucket} from "../../interfaces/bucket";
import {BucketData, BucketRow} from "../../interfaces/bucket-entry";
import {BucketDataService} from "../../services/bucket-data.service";
import {BucketService} from "../../services/bucket.service";
import {RelationSchema, RelationType} from "../relation";

@Component({
  selector: "bucket-relation",
  templateUrl: "./relation.component.html",
  styleUrls: ["./relation.component.scss"],
  providers: [
    {provide: NG_VALUE_ACCESSOR, multi: true, useExisting: forwardRef(() => RelationComponent)}
  ]
})
export class RelationComponent implements ControlValueAccessor, OnInit {
  @ViewChild(MatPaginator, {static: true}) paginator: MatPaginator;

  value: BucketRow | BucketData<BucketRow>;

  _oneToManyRelation = false;

  onTouchedFn = () => {};
  onChangeFn = (val: string | string[]) => {};

  schema$: Observable<Bucket>;

  refresh = new Subject();

  filter: {[key: string]: any} = {};
  data$: Observable<BucketData> = of([]);
  displayedProperties: Array<string> = [];

  isDataPending = false;
  cachedData;

  constructor(
    @Inject(INPUT_SCHEMA) public _schema: RelationSchema,
    private bds: BucketDataService,
    private bs: BucketService
  ) {}

  ngOnInit() {
    this._oneToManyRelation = this._schema.relationType == RelationType.OneToMany;
    this.schema$ = this.bs.getBucket(this._schema.bucketId).pipe(
      tap(schema => {
        this.displayedProperties = [schema.primary].concat("actions");
      })
    );

    this.data$ = merge(this.paginator.page, this.refresh).pipe(
      tap(() => (this.isDataPending = true)),
      switchMap(next => {
        if (!next && this.cachedData) {
          return of(this.cachedData);
        }
        return this.bds.find(this._schema.bucketId, {
          filter: this.filter && Object.keys(this.filter).length > 0 && this.filter,
          limit: this.paginator.pageSize,
          skip: this.paginator.pageSize * this.paginator.pageIndex
        });
      }),
      tap(() => (this.isDataPending = false)),
      map(result => {
        this.cachedData = result;
        this.paginator.length = result.meta.total;
        return result.data;
      })
    );
  }

  clear() {
    this.value = this._oneToManyRelation ? [] : undefined;
    this.detectChanges();
  }

  _selectRow(row: BucketRow): void {
    if (this._oneToManyRelation) {
      if (Array.isArray(this.value)) {
        if (this.value.map(v => v._id).indexOf(row._id) == -1) {
          // changing the reference will trigger the map pipe
          // do not use push instead of it
          this.value = [...this.value, row];
        } else {
          this.value = this.value.filter(val => val._id != row._id);
        }
      } else {
        this.value = [row];
      }
    } else {
      if (!this.value || this.value["_id"] != row._id) {
        this.value = row;
      } else {
        this.value = undefined;
      }
    }
    this.detectChanges();
  }

  detectChanges() {
    if (this.onChangeFn) {
      this.onChangeFn(this.valueIds());
    }
  }

  valueIds() {
    if (this.isNotResolved(this.value)) {
      return this.value as string | string[];
    }

    return this.value
      ? Array.isArray(this.value)
        ? this.value.map(v => v._id)
        : this.value._id
      : undefined;
  }

  isObject(val) {
    return typeof val == "object" && !Array.isArray(val);
  }

  isString(val) {
    return typeof val == "string";
  }

  isStringArray(val) {
    return Array.isArray(val) && val.every(v => this.isString(v));
  }

  isNotResolved(val) {
    return this.isString(val) || this.isStringArray(val);
  }

  @HostListener("click")
  onTouched(): void {
    this.onTouchedFn();
  }

  writeValue(val: BucketRow | BucketData): void {
    if (!val) {
      return;
    }
    this.value = val;
    this.detectChanges();
  }

  registerOnChange(fn: any): void {
    this.onChangeFn = fn;
  }

  registerOnTouched(fn: any): void {
    this.onTouchedFn = fn;
  }
}
