import {Component, EventEmitter, OnInit, ViewChild} from "@angular/core";
import {MatPaginator} from "@angular/material/paginator";
import {Sort} from "@angular/material/sort";
import {ActivatedRoute} from "@angular/router";
import {merge, Observable, of} from "rxjs";
import {map, switchMap, tap} from "rxjs/operators";
import {Bucket} from "../../interfaces/bucket";
import {BucketData} from "../../interfaces/bucket-entry";
import {BucketSettings} from "../../interfaces/bucket-settings";
import {BucketDataService} from "../../services/bucket-data.service";
import {BucketService} from "../../services/bucket.service";

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
  public refresh = new EventEmitter();

  public filter: {[key: string]: any} = {};
  public sort: {[key: string]: number} = {};

  public scheduledData: boolean = false;
  public readOnly: boolean = true;

  public displayedProperties: Array<string> = [];
  public properties: Array<{name: string; title: string}> = [];

  public $preferences: Observable<BucketSettings>;
  public language: string;

  public selectedItems: Array<string> = [];
  public dataIds: Array<string> = [];

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
        this.filter = {};
        this.scheduledData = false;
        this.sort = {};
        this.getData();
        this.$preferences = this.bs.getPreferences();
      }),
      switchMap(() => this.bs.getBucket(this.bucketId)),
      tap(schema => {
        if (schema) {
          this.readOnly = schema.readOnly;
          this.properties = [
            {name: "$$spicainternal_select", title: "Select"},
            ...Object.entries(schema.properties).map(([name, value]) => ({
              name,
              title: value.title
            })),
            {name: "$$spicainternal_schedule", title: "Scheduled"},
            {name: "$$spicainternal_actions", title: "Actions"}
          ];

          this.displayedProperties = [
            ...Object.entries(schema.properties)
              .filter(([, value]) => value.options.visible)
              .map(([key]) => key),
            "$$spicainternal_actions"
          ];
          if (!schema.readOnly) {
            this.displayedProperties = ["$$spicainternal_select", ...this.displayedProperties];
          }
        }
      })
    );
  }

  toggleDisplayAll(display: boolean, schema: Bucket) {
    if (display) {
      this.displayedProperties = [
        "$$spicainternal_select",
        ...Object.keys(schema.properties),
        "$$spicainternal_schedule",
        "$$spicainternal_actions"
      ];
    } else {
      this.displayedProperties = [
        "$$spicainternal_select",
        schema.primary,
        "$$spicainternal_schedule",
        "$$spicainternal_actions"
      ];
    }
  }

  toggleProperty(name: string, selected: boolean) {
    if (selected) {
      this.displayedProperties.push(name);
    } else {
      this.displayedProperties.splice(this.displayedProperties.indexOf(name), 1);
    }
    this.displayedProperties = this.displayedProperties.sort(
      (a, b) =>
        this.properties.findIndex(p => p.name == a) - this.properties.findIndex(p => p.name == b)
    );
  }

  scheduleTrigger() {
    this.scheduledData = !this.scheduledData;
    let displayScheduleIndex = this.displayedProperties.indexOf("$$spicainternal_schedule");
    if (displayScheduleIndex > -1 && !this.scheduledData) {
      this.displayedProperties.splice(displayScheduleIndex, 1);
    }
    if (displayScheduleIndex == -1 && this.scheduledData) {
      let lastIndex = this.displayedProperties.lastIndexOf("$$spicainternal_actions");
      this.displayedProperties.splice(lastIndex, 0, "$$spicainternal_schedule");
    }
    this.getData();
  }

  getData(): void {
    this.$data = merge(this.paginator.page, of(null), this.refresh).pipe(
      switchMap(() =>
        this.bds.find(this.bucketId, {
          language: this.language,
          filter: this.filter && Object.keys(this.filter).length > 0 && this.filter,
          sort: this.sort && Object.keys(this.sort).length > 0 && this.sort,
          limit: this.paginator.pageSize || 12,
          skip: this.paginator.pageSize * this.paginator.pageIndex,
          schedule: this.scheduledData
        })
      ),
      map(response => {
        this.selectedItems = [];
        this.paginator.length = (response.meta && response.meta.total) || 0;
        this.dataIds = response.data.map(d => d._id);
        return response.data;
      })
    );
  }

  sortChange(sort: Sort) {
    this.sort = {[sort.active]: sort.direction === "asc" ? 1 : -1};
    this.refresh.emit();
  }

  delete(id: string): void {
    this.bds
      .findOneAndDelete(this.bucketId, id)
      .toPromise()
      .then(() => this.refresh.emit());
  }

  deleteSelectedItems() {
    this.bds
      .deleteMany(this.bucketId, this.selectedItems)
      .toPromise()
      .then(() => this.refresh.emit());
  }
}
