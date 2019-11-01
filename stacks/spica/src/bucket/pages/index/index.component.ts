import {animate, style, transition, trigger} from "@angular/animations";
import {Component, EventEmitter, OnInit, ViewChild} from "@angular/core";
import {MatPaginator} from "@angular/material/paginator";
import {Sort} from "@angular/material/sort";
import {ActivatedRoute} from "@angular/router";
import {merge, Observable} from "rxjs";
import {flatMap, map, publishReplay, refCount, switchMap, tap} from "rxjs/operators";
import {Bucket} from "../../interfaces/bucket";
import {BucketData} from "../../interfaces/bucket-entry";
import {BucketSettings} from "../../interfaces/bucket-settings";
import {BucketDataService} from "../../services/bucket-data.service";
import {BucketService} from "../../services/bucket.service";

@Component({
  selector: "bucket-index",
  templateUrl: "./index.component.html",
  styleUrls: ["./index.component.scss"],
  animations: [
    trigger("smooth", [
      transition(":enter", [style({opacity: 0}), animate("0.5s ease-out", style({opacity: 1}))]),
      transition(":leave", [style({opacity: 1}), animate("0.5s ease-in", style({opacity: 0}))])
    ])
  ]
})
export class IndexComponent implements OnInit {
  @ViewChild(MatPaginator, {static: true}) paginator: MatPaginator;

  bucketId: string;
  schema$: Observable<Bucket>;
  data$: Observable<BucketData>;
  refresh = new EventEmitter();
  loaded: boolean;

  filter: {[key: string]: any} = {};
  sort: {[key: string]: number} = {};

  showScheduled: boolean = false;
  readOnly: boolean = true;

  displayedProperties: Array<string> = [];
  properties: Array<{name: string; title: string}> = [];

  $preferences: Observable<BucketSettings>;
  language: string;

  selectedItems: Array<string> = [];
  dataIds: Array<string> = [];

  constructor(
    private bs: BucketService,
    private bds: BucketDataService,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.$preferences = this.bs.getPreferences();

    this.schema$ = this.route.params.pipe(
      tap(params => {
        this.bucketId = params.id;
        this.paginator.pageIndex = 0;
        this.filter = undefined;
        this.showScheduled = false;
        this.sort = {};
      }),
      flatMap(() => this.bs.getBucket(this.bucketId)),
      tap(schema => {
        this.readOnly = schema.readOnly;
        this.properties = [
          ...Object.entries(schema.properties).map(([name, value]) => ({
            name,
            title: value.title
          })),
          {name: "$$spicainternal_schedule", title: "Scheduled"},
          {name: "$$spicainternal_actions", title: "Actions"}
        ];

        if (!schema.readOnly) {
          this.properties.unshift({name: "$$spicainternal_select", title: "Select"});
        }

        this.displayedProperties = [
          ...Object.entries(schema.properties)
            .filter(([, value]) => value.options.visible)
            .map(([key]) => key),
          "$$spicainternal_actions"
        ];
      }),
      publishReplay(),
      refCount()
    );

    this.data$ = merge(this.route.params, this.paginator.page, this.refresh).pipe(
      tap(() => (this.loaded = false)),
      switchMap(() =>
        this.bds.find(this.bucketId, {
          language: this.language,
          filter: this.filter && Object.keys(this.filter).length > 0 && this.filter,
          sort: this.sort && Object.keys(this.sort).length > 0 && this.sort,
          limit: this.paginator.pageSize || 10,
          skip: this.paginator.pageSize * this.paginator.pageIndex,
          schedule: this.showScheduled
        })
      ),
      map(response => {
        this.selectedItems = [];
        this.paginator.length = (response.meta && response.meta.total) || 0;
        this.dataIds = response.data.map(d => d._id);
        this.loaded = true;
        return response.data;
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

  toggleScheduled() {
    this.showScheduled = !this.showScheduled;
    let displayScheduleIndex = this.displayedProperties.indexOf("$$spicainternal_schedule");
    if (displayScheduleIndex > -1 && !this.showScheduled) {
      this.displayedProperties.splice(displayScheduleIndex, 1);
    }
    if (displayScheduleIndex == -1 && this.showScheduled) {
      let lastIndex = this.displayedProperties.lastIndexOf("$$spicainternal_actions");
      this.displayedProperties.splice(lastIndex, 0, "$$spicainternal_schedule");
    }
    this.refresh.next();
  }

  sortChange(sort: Sort) {
    if (sort.direction) {
      this.sort = {[sort.active]: sort.direction === "asc" ? 1 : -1};
    } else {
      this.sort = {};
    }

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
