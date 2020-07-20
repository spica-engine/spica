import {Component, forwardRef, HostListener, Inject, OnInit, ViewChild} from "@angular/core";
import {ControlValueAccessor, NG_VALUE_ACCESSOR} from "@angular/forms";
import {MatPaginator} from "@angular/material/paginator";
import {INPUT_SCHEMA} from "@spica-client/common";
import {BehaviorSubject, merge, Observable} from "rxjs";
import {map, switchMap, tap} from "rxjs/operators";
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

  value: string | string[];

  _oneToManyRelation = false;

  onTouchedFn = () => {};
  onChangeFn = (val: string | string[]) => {};

  schema$: Observable<Bucket>;
  selectedRows$: Observable<BucketRow[]>;

  refresh = new BehaviorSubject(null);
  filter: {[key: string]: any} = {};
  data$: Observable<BucketData>;
  displayedProperties: Array<string> = [];

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
      switchMap(() =>
        this.bds.find(this._schema.bucketId, {
          filter: this.filter && Object.keys(this.filter).length > 0 && this.filter,
          limit: this.paginator.pageSize,
          skip: this.paginator.pageSize * this.paginator.pageIndex
        })
      ),
      map(result => {
        this.paginator.length = result.meta.total;
        return result.data;
      })
    );
  }

  clear() {
    this.value = this._oneToManyRelation ? [] : undefined;
    this._fetchRows();
  }

  _selectRow(row: BucketRow): void {
    if (this._oneToManyRelation) {
      if (Array.isArray(this.value)) {
        if (!this.value.includes(row._id)) {
          this.value.push(row._id);
        } else {
          this.value = this.value.filter(val => val != row._id);
        }
      } else {
        this.value = [row._id];
      }
      this.value = Array.from(new Set(this.value));
    } else {
      if (this.value != row._id) {
        this.value = row._id;
      } else {
        this.value = undefined;
      }
    }
    this._fetchRows();
    if (this.onChangeFn) {
      this.onChangeFn(this.value);
    }
  }

  _fetchRows() {
    const ids = this._oneToManyRelation ? this.value : [this.value];
    if (ids.length == 0) {
      this.selectedRows$ = undefined;
    } else {
      this.selectedRows$ = this.schema$.pipe(
        switchMap(schema => this.bds.find(schema._id, {filter: {_id: {$in: ids}}})),
        map(data => data.data)
      );
    }
  }

  @HostListener("click")
  onTouched(): void {
    this.onTouchedFn();
  }

  writeValue(val: string | string[]): void {
    if (!val) {
      return;
    }
    this.value = val;
    this._fetchRows();
  }

  registerOnChange(fn: any): void {
    this.onChangeFn = fn;
  }

  registerOnTouched(fn: any): void {
    this.onTouchedFn = fn;
  }
}
